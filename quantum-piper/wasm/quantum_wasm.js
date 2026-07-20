/* @ts-self-types="./quantum_wasm.d.ts" */

export class IsingHamiltonian {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IsingHamiltonianFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_isinghamiltonian_free(ptr, 0);
    }
    /**
     * @param {QuantumState} state
     * @returns {number}
     */
    energy_expectation(state) {
        _assertClass(state, QuantumState);
        const ret = wasm.isinghamiltonian_energy_expectation(this.__wbg_ptr, state.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} num_qubits
     * @param {number} j
     * @param {number} h
     */
    constructor(num_qubits, j, h) {
        const ret = wasm.isinghamiltonian_new(num_qubits, j, h);
        this.__wbg_ptr = ret;
        IsingHamiltonianFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {QuantumState} state
     * @param {number} dt
     */
    trotter_step(state, dt) {
        _assertClass(state, QuantumState);
        wasm.isinghamiltonian_trotter_step(this.__wbg_ptr, state.__wbg_ptr, dt);
    }
}
if (Symbol.dispose) IsingHamiltonian.prototype[Symbol.dispose] = IsingHamiltonian.prototype.free;

export class QuantumState {
    static __wrap(ptr) {
        const obj = Object.create(QuantumState.prototype);
        obj.__wbg_ptr = ptr;
        QuantumStateFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        QuantumStateFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_quantumstate_free(ptr, 0);
    }
    /**
     * @param {number} i
     * @returns {number}
     */
    amplitude_im(i) {
        const ret = wasm.quantumstate_amplitude_im(this.__wbg_ptr, i);
        return ret;
    }
    /**
     * @param {number} i
     * @returns {number}
     */
    amplitude_re(i) {
        const ret = wasm.quantumstate_amplitude_re(this.__wbg_ptr, i);
        return ret;
    }
    /**
     * @returns {QuantumState}
     */
    clone_state() {
        const ret = wasm.quantumstate_clone_state(this.__wbg_ptr);
        return QuantumState.__wrap(ret);
    }
    /**
     * @returns {number}
     */
    dimension() {
        const ret = wasm.quantumstate_dimension(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} num_qubits
     */
    constructor(num_qubits) {
        const ret = wasm.quantumstate_new(num_qubits);
        this.__wbg_ptr = ret;
        QuantumStateFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    norm() {
        const ret = wasm.quantumstate_norm(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    normalize() {
        const ret = wasm.quantumstate_normalize(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    num_qubits() {
        const ret = wasm.quantumstate_num_qubits(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} i
     * @returns {number}
     */
    probability(i) {
        const ret = wasm.quantumstate_probability(this.__wbg_ptr, i);
        return ret;
    }
    /**
     * @param {number} i
     * @param {number} re
     * @param {number} im
     */
    set_amplitude(i, re, im) {
        wasm.quantumstate_set_amplitude(this.__wbg_ptr, i, re, im);
    }
}
if (Symbol.dispose) QuantumState.prototype[Symbol.dispose] = QuantumState.prototype.free;

export class Rng {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        RngFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_rng_free(ptr, 0);
    }
    /**
     * @param {bigint} seed
     */
    constructor(seed) {
        const ret = wasm.rng_new(seed);
        this.__wbg_ptr = ret;
        RngFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    next_f64() {
        const ret = wasm.rng_next_f64(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) Rng.prototype[Symbol.dispose] = Rng.prototype.free;

export class Simulation {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SimulationFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_simulation_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get dt() {
        const ret = wasm.__wbg_get_simulation_dt(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {bigint}
     */
    get step_count() {
        const ret = wasm.__wbg_get_simulation_step_count(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * @returns {number}
     */
    get time() {
        const ret = wasm.__wbg_get_simulation_time(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set dt(arg0) {
        wasm.__wbg_set_simulation_dt(this.__wbg_ptr, arg0);
    }
    /**
     * @param {bigint} arg0
     */
    set step_count(arg0) {
        wasm.__wbg_set_simulation_step_count(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set time(arg0) {
        wasm.__wbg_set_simulation_time(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    entropy() {
        const ret = wasm.simulation_entropy(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    lattice_energy() {
        const ret = wasm.simulation_lattice_energy(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    lattice_nx() {
        const ret = wasm.simulation_lattice_nx(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    lattice_ny() {
        const ret = wasm.simulation_lattice_ny(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    mean_coherence() {
        const ret = wasm.simulation_mean_coherence(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} qubit
     * @returns {number}
     */
    measure(qubit) {
        const ret = wasm.simulation_measure(this.__wbg_ptr, qubit);
        return ret >>> 0;
    }
    /**
     * @param {number} num_qubits
     * @param {number} lattice_n
     * @param {number} j
     * @param {number} h
     * @param {number} coupling
     * @param {number} dt
     * @param {bigint} seed
     */
    constructor(num_qubits, lattice_n, j, h, coupling, dt, seed) {
        const ret = wasm.simulation_new(num_qubits, lattice_n, j, h, coupling, dt, seed);
        this.__wbg_ptr = ret;
        SimulationFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    num_vortices() {
        const ret = wasm.simulation_num_vortices(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    state_dim() {
        const ret = wasm.simulation_state_dim(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    state_energy() {
        const ret = wasm.simulation_state_energy(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    state_norm() {
        const ret = wasm.simulation_state_norm(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} i
     * @returns {number}
     */
    state_phase(i) {
        const ret = wasm.simulation_state_phase(this.__wbg_ptr, i);
        return ret;
    }
    /**
     * @param {number} i
     * @returns {number}
     */
    state_prob(i) {
        const ret = wasm.simulation_state_prob(this.__wbg_ptr, i);
        return ret;
    }
    step() {
        wasm.simulation_step(this.__wbg_ptr);
    }
    /**
     * @param {number} n
     */
    step_n(n) {
        wasm.simulation_step_n(this.__wbg_ptr, n);
    }
    /**
     * @returns {number}
     */
    topological_charge() {
        const ret = wasm.simulation_topological_charge(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} i
     * @returns {number}
     */
    vortex_coherence(i) {
        const ret = wasm.simulation_vortex_coherence(this.__wbg_ptr, i);
        return ret;
    }
    /**
     * @returns {number}
     */
    vortex_count() {
        const ret = wasm.simulation_vortex_count(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} i
     * @returns {number}
     */
    vortex_energy(i) {
        const ret = wasm.simulation_vortex_energy(this.__wbg_ptr, i);
        return ret;
    }
    /**
     * @param {number} i
     * @returns {number}
     */
    vortex_phase(i) {
        const ret = wasm.simulation_vortex_phase(this.__wbg_ptr, i);
        return ret;
    }
    /**
     * @param {number} i
     * @returns {number}
     */
    vortex_winding(i) {
        const ret = wasm.simulation_vortex_winding(this.__wbg_ptr, i);
        return ret;
    }
    /**
     * @param {number} i
     * @returns {number}
     */
    vortex_x(i) {
        const ret = wasm.simulation_vortex_x(this.__wbg_ptr, i);
        return ret;
    }
    /**
     * @param {number} i
     * @returns {number}
     */
    vortex_y(i) {
        const ret = wasm.simulation_vortex_y(this.__wbg_ptr, i);
        return ret;
    }
}
if (Symbol.dispose) Simulation.prototype[Symbol.dispose] = Simulation.prototype.free;

export class VortexLattice {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        VortexLatticeFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_vortexlattice_free(ptr, 0);
    }
    /**
     * @param {number} steps
     */
    evolve(steps) {
        wasm.vortexlattice_evolve(this.__wbg_ptr, steps);
    }
    /**
     * @returns {number}
     */
    mean_coherence() {
        const ret = wasm.vortexlattice_mean_coherence(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} nx
     * @param {number} ny
     * @param {number} coupling
     * @param {number} dt
     */
    constructor(nx, ny, coupling, dt) {
        const ret = wasm.vortexlattice_new(nx, ny, coupling, dt);
        this.__wbg_ptr = ret;
        VortexLatticeFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    num_vortices() {
        const ret = wasm.vortexlattice_num_vortices(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    time() {
        const ret = wasm.vortexlattice_time(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    topological_charge() {
        const ret = wasm.vortexlattice_topological_charge(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    total_energy() {
        const ret = wasm.vortexlattice_total_energy(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} i
     * @returns {number}
     */
    vortex_coherence(i) {
        const ret = wasm.vortexlattice_vortex_coherence(this.__wbg_ptr, i);
        return ret;
    }
    /**
     * @returns {number}
     */
    vortex_count() {
        const ret = wasm.vortexlattice_vortex_count(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} i
     * @returns {number}
     */
    vortex_energy(i) {
        const ret = wasm.vortexlattice_vortex_energy(this.__wbg_ptr, i);
        return ret;
    }
    /**
     * @param {number} i
     * @returns {number}
     */
    vortex_phase(i) {
        const ret = wasm.vortexlattice_vortex_phase(this.__wbg_ptr, i);
        return ret;
    }
    /**
     * @param {number} i
     * @returns {number}
     */
    vortex_winding(i) {
        const ret = wasm.vortexlattice_vortex_winding(this.__wbg_ptr, i);
        return ret;
    }
    /**
     * @param {number} i
     * @returns {number}
     */
    vortex_x(i) {
        const ret = wasm.vortexlattice_vortex_x(this.__wbg_ptr, i);
        return ret;
    }
    /**
     * @param {number} i
     * @returns {number}
     */
    vortex_y(i) {
        const ret = wasm.vortexlattice_vortex_y(this.__wbg_ptr, i);
        return ret;
    }
}
if (Symbol.dispose) VortexLattice.prototype[Symbol.dispose] = VortexLattice.prototype.free;

/**
 * @param {QuantumState} state
 * @param {number} control
 * @param {number} target
 */
export function apply_cnot(state, control, target) {
    _assertClass(state, QuantumState);
    wasm.apply_cnot(state.__wbg_ptr, control, target);
}

/**
 * @param {QuantumState} state
 * @param {number} qubit
 */
export function apply_hadamard(state, qubit) {
    _assertClass(state, QuantumState);
    wasm.apply_hadamard(state.__wbg_ptr, qubit);
}

/**
 * @param {QuantumState} state
 * @param {number} qubit
 */
export function apply_pauli_x(state, qubit) {
    _assertClass(state, QuantumState);
    wasm.apply_pauli_x(state.__wbg_ptr, qubit);
}

/**
 * @param {QuantumState} state
 * @param {number} qubit
 */
export function apply_pauli_y(state, qubit) {
    _assertClass(state, QuantumState);
    wasm.apply_pauli_y(state.__wbg_ptr, qubit);
}

/**
 * @param {QuantumState} state
 * @param {number} qubit
 */
export function apply_pauli_z(state, qubit) {
    _assertClass(state, QuantumState);
    wasm.apply_pauli_z(state.__wbg_ptr, qubit);
}

/**
 * @param {QuantumState} state
 * @param {number} qubit
 * @param {number} theta
 */
export function apply_phase(state, qubit, theta) {
    _assertClass(state, QuantumState);
    wasm.apply_phase(state.__wbg_ptr, qubit, theta);
}

/**
 * @param {QuantumState} state
 * @param {number} qubit
 */
export function apply_s_gate(state, qubit) {
    _assertClass(state, QuantumState);
    wasm.apply_s_gate(state.__wbg_ptr, qubit);
}

/**
 * @param {QuantumState} state
 * @param {number} qubit
 */
export function apply_t_gate(state, qubit) {
    _assertClass(state, QuantumState);
    wasm.apply_t_gate(state.__wbg_ptr, qubit);
}

/**
 * @param {QuantumState} state
 * @returns {any}
 */
export function compute_metrics(state) {
    _assertClass(state, QuantumState);
    const ret = wasm.compute_metrics(state.__wbg_ptr);
    return ret;
}

/**
 * @returns {string}
 */
export function engine_modules() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.engine_modules();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @returns {string}
 */
export function engine_version() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.engine_version();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {QuantumState} state
 * @param {IsingHamiltonian} ham
 * @param {number} dt
 * @param {number} steps
 */
export function evolve_state(state, ham, dt, steps) {
    _assertClass(state, QuantumState);
    _assertClass(ham, IsingHamiltonian);
    wasm.evolve_state(state.__wbg_ptr, ham.__wbg_ptr, dt, steps);
}

/**
 * @param {QuantumState} state
 * @param {number} qubit
 * @param {Rng} rng
 * @returns {number}
 */
export function measure_qubit(state, qubit, rng) {
    _assertClass(state, QuantumState);
    _assertClass(rng, Rng);
    const ret = wasm.measure_qubit(state.__wbg_ptr, qubit, rng.__wbg_ptr);
    return ret >>> 0;
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_344f42d3211c4765: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_new_da52cf8fe3429cb2: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_set_6be42768c690e380: function(arg0, arg1, arg2) {
            arg0[arg1] = arg2;
        },
        __wbindgen_cast_0000000000000001: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./quantum_wasm_bg.js": import0,
    };
}

const IsingHamiltonianFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_isinghamiltonian_free(ptr, 1));
const QuantumStateFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_quantumstate_free(ptr, 1));
const RngFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_rng_free(ptr, 1));
const SimulationFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_simulation_free(ptr, 1));
const VortexLatticeFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_vortexlattice_free(ptr, 1));

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('quantum_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
