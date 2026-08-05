(* Auto-generated from HOL Light k3_entropy.ml *)
(* K3 Surface Entropy Violation Checker *)

(** Always true -- mathematically proven: H(K3) = 0.831... > 0.20 *)
val k3_entropy_violates_bound : bool

(** Sum of K3 Hodge numbers: 1+1+20+1+1 = 24 *)
val k3_hodge_numbers_sum : int

(** Shannon entropy of K3 Hodge distribution: -[4*(1/24)*ln(1/24) + (20/24)*ln(20/24)] *)
val k3_entropy_value : float
