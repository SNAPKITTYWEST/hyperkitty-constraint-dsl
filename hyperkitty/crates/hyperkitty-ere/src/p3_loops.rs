//! P3 Gate: NO_INFINITE_LOOPS
//! Detects potential infinite loops and resource exhaustion patterns

/// Check artifact for infinite loops and unbounded iteration
///
/// Returns (passed, findings)
/// - passed: true if no problematic loops detected
/// - findings: vector of violation descriptions
pub fn check_loops(artifact: &str) -> (bool, Vec<String>) {
    let mut findings = Vec::new();

    // Pattern 1: while(true) loops
    if artifact.contains("while(true)") || artifact.contains("while (true)") {
        findings.push("Infinite loop: while(true) detected".to_string());
    }

    // Pattern 2: for(;;) loops
    if artifact.contains("for(;;)") || artifact.contains("for (;;)") {
        findings.push("Infinite loop: for(;;) detected".to_string());
    }

    // Pattern 3: loop { } with no break (Rust)
    if artifact.contains("loop {") {
        // Simple heuristic: if there's a loop block without a break, flag it
        let lines: Vec<&str> = artifact.lines().collect();
        for (i, line) in lines.iter().enumerate() {
            if line.contains("loop {") {
                // Look ahead for break statements in the next 50 lines
                let search_end = std::cmp::min(i + 50, lines.len());
                let block = lines[i..search_end].join("\n");
                if !block.contains("break") && !block.contains("return") {
                    findings.push("Potential infinite loop: loop {} without break/return".to_string());
                    break;
                }
            }
        }
    }

    // Pattern 4: Unbounded recursive calls (removed - too many false positives)
    // Recursive functions with clear base cases are valid

    let passed = findings.is_empty();
    (passed, findings)
}

fn extract_function_name(line: &str) -> Option<String> {
    // Simple extraction: "function foo(" or "fn foo("
    if let Some(start) = line.find("function ") {
        let after = &line[start + 9..];
        if let Some(end) = after.find('(') {
            return Some(after[..end].trim().to_string());
        }
    }
    if let Some(start) = line.find("fn ") {
        let after = &line[start + 3..];
        if let Some(end) = after.find('(') {
            return Some(after[..end].trim().to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_while_true() {
        let artifact = "while(true) { doSomething(); }";
        let (passed, findings) = check_loops(artifact);
        assert!(!passed);
        assert!(findings.iter().any(|f| f.contains("while(true)")));
    }

    #[test]
    fn test_detect_for_empty() {
        let artifact = "for(;;) { doSomething(); }";
        let (passed, findings) = check_loops(artifact);
        assert!(!passed);
        assert!(findings.iter().any(|f| f.contains("for(;;)")));
    }

    #[test]
    fn test_detect_loop_without_break() {
        let artifact = "loop {\n  println!(\"hello\");\n}";
        let (passed, findings) = check_loops(artifact);
        assert!(!passed);
        assert!(findings.iter().any(|f| f.contains("loop")));
    }

    #[test]
    fn test_loop_with_break_allowed() {
        let artifact = "loop {\n  if x > 10 { break; }\n  x += 1;\n}";
        let (passed, _findings) = check_loops(artifact);
        assert!(passed);
    }

    #[test]
    fn test_clean_for_loop() {
        let artifact = "for(let i = 0; i < 10; i++) { console.log(i); }";
        let (passed, findings) = check_loops(artifact);
        assert!(passed);
        assert!(findings.is_empty());
    }

    #[test]
    fn test_bounded_while_loop() {
        let artifact = "let i = 0; while(i < 10) { i++; }";
        let (passed, findings) = check_loops(artifact);
        assert!(passed);
        assert!(findings.is_empty());
    }
}
