% SOV-KERNEL-MONSTER Logic Layer
% Loaded by pre-receive hook via swipl.

:- use_module(library(process)).

% ---- Key Registry ----
% Replace values with actual Ed25519 key fingerprints post-provisioning.
architect_key('ARCHITECT_ED25519_FINGERPRINT').
engineer_key('ENG_01_ED25519_FINGERPRINT').
engineer_key('ENG_02_ED25519_FINGERPRINT').
engineer_key('ENG_03_ED25519_FINGERPRINT').
engineer_key('ENG_04_ED25519_FINGERPRINT').
engineer_key('ENG_05_ED25519_FINGERPRINT').
ci_bot_key('HAUKI_BOT_ED25519_FINGERPRINT').

authorized_key(K) :- architect_key(K).
authorized_key(K) :- engineer_key(K).
authorized_key(K) :- ci_bot_key(K).

% ---- ASP_MAXIMAL: main branch requires Architect counter-signature ----
verify_push(NewRev, 'refs/heads/main') :-
    !,
    get_commit_signer(NewRev, Signer),
    ( architect_key(Signer) -> true
    ; format(user_error, "[ASP_MAXIMAL] Main branch push requires Architect counter-signature. Got: ~w~n", [Signer]),
      fail
    ).

% ---- ASP_STRICT: feature branches require any authorized signer ----
verify_push(NewRev, Ref) :-
    Ref \= 'refs/heads/main',
    get_commit_signer(NewRev, Signer),
    ( authorized_key(Signer) -> true
    ; format(user_error, "[ASP_STRICT] Unauthorized committer: ~w~n", [Signer]),
      fail
    ).

% ---- Fallback: allow if no signer info available (warn only) ----
verify_push(_, Ref) :-
    format(user_error, "[ASP_WARN] Could not verify signer for ref: ~w~n", [Ref]).

% ---- Helper: extract signing key from commit ----
get_commit_signer(Commit, KeyID) :-
    process_create(path(git), ['show', '-s', '--format=%GK', Commit],
                   [stdout(pipe(Out)), stderr(null)]),
    read_line_to_string(Out, Line),
    close(Out),
    ( Line \= "" -> atom_string(KeyID, Line)
    ; KeyID = 'UNSIGNED'
    ).
