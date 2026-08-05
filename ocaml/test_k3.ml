(* Test the K3 entropy violation checker *)
open K3_checker

let () =
  Printf.printf "K3 Surface Entropy Violation Checker\n";
  Printf.printf "=====================================\n";
  Printf.printf "Hodge numbers sum: %d\n" k3_hodge_numbers_sum;
  Printf.printf "Entropy value: %.16f nats\n" k3_entropy_value;
  Printf.printf "Entropy bound: 0.20 nats\n";
  Printf.printf "Violation: %b\n\n" k3_entropy_violates_bound;
  assert (k3_hodge_numbers_sum = 24);
  assert (k3_entropy_value > 0.20);
  assert (k3_entropy_violates_bound = true);
  Printf.printf "ALL TESTS PASSED -- K3 ENTROPY VIOLATION CONFIRMED\n"
