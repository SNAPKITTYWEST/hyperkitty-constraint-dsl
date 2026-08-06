//! P2 Gate: NO_EVAL
//! Detects dynamic code evaluation (eval, Function constructor, etc.)

use regex::Regex;
use std::sync::OnceLock;

/// JavaScript eval() pattern
fn js_eval_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r#"\beval\s*\("#).expect("Valid regex"))
}

/// JavaScript exec() pattern
fn js_exec_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r#"\bexec\s*\("#).expect("Valid regex"))
}

/// JavaScript Function constructor with string (new Function(...))
fn js_function_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"new\s+Function\s*\(").expect("Valid regex"))
}

/// JavaScript setTimeout/setInterval with string
fn js_timeout_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(r#"(?:set|clear)(?:Timeout|Interval)\s*\(\s*['"]"#).expect("Valid regex")
    })
}

/// Python exec() or eval()
fn python_exec_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r#"(?:^|\s|=)(?:exec|eval)\s*\("#).expect("Valid regex"))
}

/// Python subprocess.call/run with shell=True
fn python_subprocess_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"subprocess\.(?:call|run|Popen)\s*\(").expect("Valid regex"))
}

/// Java Runtime.getRuntime().exec()
fn java_runtime_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"(?:Runtime|getRuntime).*\.exec\s*\(").expect("Valid regex"))
}

/// Shell script eval or similar
fn shell_eval_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"(?:^|\s)eval\s+").expect("Valid regex"))
}

/// Unsafe indirect function call patterns
fn indirect_call_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(r#"(?:\$\(|`|(?:call|invoke|apply)\s*\()"#).expect("Valid regex")
    })
}

/// Check artifact for dynamic code execution patterns
///
/// Returns (passed, findings)
/// - passed: true if no eval patterns detected
/// - findings: vector of violation descriptions with line numbers
pub fn check_eval(artifact: &str) -> (bool, Vec<String>) {
    let mut findings = Vec::new();

    for (line_num, line) in artifact.lines().enumerate() {
        let line_no = line_num + 1;

        // Skip comments
        let trimmed = line.trim_start();
        if trimmed.starts_with("//") || trimmed.starts_with("#") {
            continue;
        }

        // JavaScript eval()
        if js_eval_regex().is_match(line) {
            findings.push(format!("Line {}: JavaScript eval() detected", line_no));
        }

        // JavaScript exec()
        if js_exec_regex().is_match(line) {
            findings.push(format!("Line {}: JavaScript exec() detected", line_no));
        }

        // new Function() constructor
        if js_function_regex().is_match(line) {
            findings.push(format!("Line {}: Function constructor with dynamic code detected", line_no));
        }

        // setTimeout/setInterval with string
        if js_timeout_regex().is_match(line) {
            findings.push(format!("Line {}: setTimeout/setInterval with string detected", line_no));
        }

        // Python exec/eval
        if python_exec_regex().is_match(line) {
            findings.push(format!("Line {}: Python exec() or eval() detected", line_no));
        }

        // Python subprocess
        if python_subprocess_regex().is_match(line) {
            findings.push(format!("Line {}: Python subprocess execution detected", line_no));
        }

        // Java Runtime.exec()
        if java_runtime_regex().is_match(line) {
            findings.push(format!("Line {}: Java Runtime.exec() detected", line_no));
        }

        // Shell eval
        if shell_eval_regex().is_match(line) {
            findings.push(format!("Line {}: Shell eval command detected", line_no));
        }

        // Indirect/command substitution patterns
        if indirect_call_regex().is_match(line) {
            findings.push(format!("Line {}: Indirect function call or command substitution detected", line_no));
        }
    }

    let passed = findings.is_empty();
    (passed, findings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_eval() {
        let artifact = "const result = eval('1 + 2')";
        let (passed, findings) = check_eval(artifact);
        assert!(!passed);
        assert!(!findings.is_empty());
        assert!(findings[0].contains("eval()"));
    }

    #[test]
    fn test_detect_function_constructor() {
        let artifact = "const fn = new Function('a', 'b', 'return a + b');";
        let (passed, findings) = check_eval(artifact);
        assert!(!passed);
        assert!(!findings.is_empty());
        assert!(findings[0].contains("Function constructor"));
    }

    #[test]
    fn test_eval_in_comment_allowed() {
        let artifact = "// eval() is dangerous\nfunction safe() { return 42; }";
        let (passed, _findings) = check_eval(artifact);
        assert!(passed);
    }

    #[test]
    fn test_clean_code() {
        let artifact = "function add(a, b) { return a + b; }";
        let (passed, findings) = check_eval(artifact);
        assert!(passed);
        assert!(findings.is_empty());
    }

    #[test]
    fn test_detect_settimeout_with_string() {
        let artifact = "setTimeout('doSomething()', 1000);";
        let (passed, findings) = check_eval(artifact);
        assert!(!passed);
        assert!(!findings.is_empty());
        assert!(findings[0].contains("setTimeout"));
    }

    #[test]
    fn test_detect_python_exec() {
        let artifact = "exec(code_string)";
        let (passed, findings) = check_eval(artifact);
        assert!(!passed);
        assert!(!findings.is_empty());
        assert!(findings[0].contains("Python exec()") || findings[0].contains("exec()") || findings[0].contains("detected"));
    }

    #[test]
    fn test_detect_subprocess_call() {
        let artifact = "subprocess.call(user_input)";
        let (passed, findings) = check_eval(artifact);
        assert!(!passed);
        assert!(!findings.is_empty());
        assert!(findings[0].contains("subprocess"));
    }

    #[test]
    fn test_detect_java_runtime() {
        let artifact = "Runtime.getRuntime().exec(command);";
        let (passed, findings) = check_eval(artifact);
        assert!(!passed);
        assert!(!findings.is_empty());
        assert!(findings[0].contains("Runtime.exec()") || findings[0].contains("exec()") || findings[0].contains("detected"));
    }

    #[test]
    fn test_line_numbers_in_eval_findings() {
        let artifact = "line 1\nline 2\neval('dangerous')\nline 4";
        let (passed, findings) = check_eval(artifact);
        assert!(!passed);
        assert!(findings[0].contains("Line 3"));
    }
}
