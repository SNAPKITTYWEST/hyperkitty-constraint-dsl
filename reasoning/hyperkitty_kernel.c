// HyperKitty C-- Kernel
// Authority: Route decision validation + state commitment
// Size target: ~250 lines substantive
// Role: Final gate before state mutation

#include <stdint.h>
#include <stdbool.h>
#include <string.h>
#include "hyperkitty_bus.h"

// RouteDecision ABI (must match Rust RouteDecision)
#define ROUTE_DECISION_ABI_VERSION 1
#define ROUTE_DECISION_SIZE 88

typedef struct {
    uint32_t abi_version;
    uint8_t current_state;
    uint8_t previous_state;
    uint8_t next_state;
    uint8_t padding_0;
    uint32_t accepted;
    uint32_t failed_gate;
    double entropy;
    uint32_t entropy_ok;
    uint32_t padding_1;
    uint32_t reconciliation_ok;
    uint32_t route_valid;
    uint32_t invariant_preserved;
    uint64_t trace_id;
    uint32_t proof_ok;
    uint32_t padding_2;
} route_decision_t;

// Kernel state
typedef struct {
    uint8_t committed_state;
    uint64_t committed_at;
    double last_entropy;
    uint64_t acceptance_count;
    uint64_t rejection_count;
} kernel_state_t;

static kernel_state_t kernel = {
    .committed_state = 0xFF, // Lambda (init)
    .committed_at = 0,
    .last_entropy = 0.0,
    .acceptance_count = 0,
    .rejection_count = 0
};

// Validation gates
typedef enum {
    GATE_HEADER = 1,
    GATE_GLYPHS = 2,
    GATE_ENTROPY = 3,
    GATE_VALIDITY = 4,
    GATE_CONSISTENCY = 5,
} validation_gate_t;

// Trace record for WORM
typedef struct {
    uint64_t trace_id;
    uint8_t decision;     // 0=rejected, 1=accepted
    uint8_t failed_gate;  // gate code
    double entropy;
    uint8_t previous;
    uint8_t current;
    uint8_t next;
} trace_record_t;

// Forward declarations
static bool validate_header(const route_decision_t *d);
static bool validate_glyphs(const route_decision_t *d);
static bool validate_entropy(const route_decision_t *d);
static bool validate_consistency(const route_decision_t *d);
static void emit_trace(const route_decision_t *d, bool accepted, validation_gate_t gate);
static void commit_state(const route_decision_t *d);

// ============================================================
// Validation: Deterministic checks with fail-closed semantics
// ============================================================

static bool validate_header(const route_decision_t *d) {
    if (d->abi_version != ROUTE_DECISION_ABI_VERSION) {
        return false;
    }
    return true;
}

static bool validate_glyphs(const route_decision_t *d) {
    // Valid glyph indices: 0-5
    if (d->current_state > 5) return false;
    if (d->previous_state > 5) return false;
    if (d->next_state > 5) return false;
    return true;
}

static bool validate_entropy(const route_decision_t *d) {
    // Check finiteness
    if (!(d->entropy >= 0.0 && d->entropy <= 0.20)) {
        return false;
    }
    // Check for NaN (NaN != NaN)
    if (d->entropy != d->entropy) {
        return false;
    }
    return true;
}

static bool validate_consistency(const route_decision_t *d) {
    // If accepted, all gates must be OK
    if (d->accepted == 1) {
        if (d->entropy_ok == 0) return false;
        if (d->reconciliation_ok == 0) return false;
        if (d->route_valid == 0) return false;
        if (d->proof_ok == 0) return false;
    }
    // If rejected, failed_gate must be non-zero
    if (d->accepted == 0 && d->failed_gate == 0) {
        return false;
    }
    return true;
}

// ============================================================
// Trace and Receipt
// ============================================================

static void emit_trace(const route_decision_t *d, bool accepted, validation_gate_t gate) {
    // In production, write to WORM append-only log
    // For now, struct definition for sealed receipt format
    trace_record_t tr = {
        .trace_id = d->trace_id,
        .decision = accepted ? 1 : 0,
        .failed_gate = gate,
        .entropy = d->entropy,
        .previous = d->previous_state,
        .current = d->current_state,
        .next = d->next_state,
    };
    (void)tr; // Placeholder: in production, write tr to WORM
}

static void commit_state(const route_decision_t *d) {
    kernel.committed_state = d->next_state;
    kernel.committed_at = kernel.committed_at + 1;
    kernel.last_entropy = d->entropy;
    kernel.acceptance_count = kernel.acceptance_count + 1;
}

// ============================================================
// Main kernel entry point
// ============================================================

typedef struct {
    int32_t status;        // 0=accept, <0=reject
    validation_gate_t gate;
    uint64_t trace_id;
} kernel_result_t;

kernel_result_t hk_kernel_decide(const route_decision_t *d) {
    kernel_result_t result = {0, GATE_HEADER, 0};

    if (!d) {
        result.status = -1;
        result.gate = GATE_HEADER;
        return result;
    }

    result.trace_id = d->trace_id;

    // GATE 1: ABI Header
    if (!validate_header(d)) {
        result.status = -1;
        result.gate = GATE_HEADER;
        emit_trace(d, false, GATE_HEADER);
        kernel.rejection_count = kernel.rejection_count + 1;
        return result;
    }

    // GATE 2: Glyph Validity
    if (!validate_glyphs(d)) {
        result.status = -2;
        result.gate = GATE_GLYPHS;
        emit_trace(d, false, GATE_GLYPHS);
        kernel.rejection_count = kernel.rejection_count + 1;
        return result;
    }

    // GATE 3: Entropy Bounds
    if (!validate_entropy(d)) {
        result.status = -3;
        result.gate = GATE_ENTROPY;
        emit_trace(d, false, GATE_ENTROPY);
        kernel.rejection_count = kernel.rejection_count + 1;
        return result;
    }

    // GATE 4: Validity Status
    if (d->accepted == 0) {
        result.status = -4;
        result.gate = GATE_VALIDITY;
        emit_trace(d, false, GATE_VALIDITY);
        kernel.rejection_count = kernel.rejection_count + 1;
        return result;
    }

    // GATE 5: Consistency (all OK flags must align)
    if (!validate_consistency(d)) {
        result.status = -5;
        result.gate = GATE_CONSISTENCY;
        emit_trace(d, false, GATE_CONSISTENCY);
        kernel.rejection_count = kernel.rejection_count + 1;
        return result;
    }

    // All gates pass: commit
    commit_state(d);
    emit_trace(d, true, 0);
    result.status = 0;
    result.gate = 0;

    return result;
}

// ============================================================
// Query interface (no mutation)
// ============================================================

uint8_t hk_kernel_get_state(void) {
    return kernel.committed_state;
}

uint64_t hk_kernel_get_acceptance_count(void) {
    return kernel.acceptance_count;
}

uint64_t hk_kernel_get_rejection_count(void) {
    return kernel.rejection_count;
}

double hk_kernel_get_last_entropy(void) {
    return kernel.last_entropy;
}

// ============================================================
// Tests (if compiled with -DHK_ENABLE_TESTS)
// ============================================================

#ifdef HK_ENABLE_TESTS

#include <stdio.h>
#include <assert.h>

static route_decision_t make_valid_decision(void) {
    route_decision_t d = {0};
    d.abi_version = ROUTE_DECISION_ABI_VERSION;
    d.current_state = 0; // Pi
    d.previous_state = 1; // Gamma
    d.next_state = 2; // Delta
    d.entropy = 0.15;
    d.accepted = 1;
    d.entropy_ok = 1;
    d.reconciliation_ok = 1;
    d.route_valid = 1;
    d.invariant_preserved = 1;
    d.proof_ok = 1;
    d.trace_id = 42;
    return d;
}

void hk_kernel_test_valid_decision(void) {
    route_decision_t d = make_valid_decision();
    kernel_result_t r = hk_kernel_decide(&d);
    assert(r.status == 0);
    assert(hk_kernel_get_acceptance_count() == 1);
    printf("✓ test_valid_decision\n");
}

void hk_kernel_test_bad_abi(void) {
    route_decision_t d = make_valid_decision();
    d.abi_version = 999;
    kernel_result_t r = hk_kernel_decide(&d);
    assert(r.status == -1);
    assert(hk_kernel_get_rejection_count() >= 1);
    printf("✓ test_bad_abi\n");
}

void hk_kernel_test_high_entropy(void) {
    route_decision_t d = make_valid_decision();
    d.entropy = 0.25; // Exceeds MAX_ENTROPY (0.20)
    kernel_result_t r = hk_kernel_decide(&d);
    assert(r.status == -3);
    printf("✓ test_high_entropy\n");
}

void hk_kernel_test_rejected_decision(void) {
    route_decision_t d = make_valid_decision();
    d.accepted = 0;
    d.failed_gate = 4; // Proof gate
    kernel_result_t r = hk_kernel_decide(&d);
    assert(r.status == -4);
    printf("✓ test_rejected_decision\n");
}

void hk_kernel_test_consistency_fail(void) {
    route_decision_t d = make_valid_decision();
    d.accepted = 1;
    d.entropy_ok = 0; // Contradiction!
    kernel_result_t r = hk_kernel_decide(&d);
    assert(r.status == -5);
    printf("✓ test_consistency_fail\n");
}

void hk_kernel_run_tests(void) {
    printf("=== HyperKitty C-- Kernel Tests ===\n");
    hk_kernel_test_valid_decision();
    hk_kernel_test_bad_abi();
    hk_kernel_test_high_entropy();
    hk_kernel_test_rejected_decision();
    hk_kernel_test_consistency_fail();
    printf("=== All tests passed ===\n");
}

#endif // HK_ENABLE_TESTS
