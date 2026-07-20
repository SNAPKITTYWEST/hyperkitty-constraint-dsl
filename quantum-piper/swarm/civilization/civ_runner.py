"""
civ_runner.py — SnapKitty Digital Civilization Coordinator
===========================================================
The brain that runs the civilization autonomously. No human input.

15 agents live in The Vortex. Every tick they wake up, query ROBOB,
decide what to do, and act — or stay silent. WORM sealed. Always.

Architecture:
  CivRunner drives the tick loop
  Each agent has: personality, resources, memory, Uniprise, farm
  CARTO summons legal meetings when violations are detected
  PHANTOM watches all actions for Trust Deed violations
  NOVA generates ASCII murals from events
  CIPHER seals every major event into the WORM ledger

Run:
  python civ_runner.py           — live civilization loop
  python civ_runner.py --once    — run one tick and print state
  python civ_runner.py --demo    — run the CARTO summons demo scenario
"""

import json, os, sys, time, random, hashlib, urllib.request, threading
from pathlib import Path
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding='utf-8')

BASE      = Path(__file__).parent
REPO_ROOT = BASE.parent.parent.parent
AGENTS_F  = BASE / 'agents.json'
WORM_F    = BASE / '.civ-worm.jsonl'
STATE_F   = BASE / '.civ-state.json'
DEEDS_F   = BASE / '.trust-deeds.jsonl'
MURALS_F  = BASE / '.nova-murals.jsonl'

ROBOB_URL = 'http://localhost:7475'
BOB_URL   = 'http://localhost:7474'
TICK_SEC  = 8.0

# ── WORM ──────────────────────────────────────────────────────────────────────
_worm_lock = threading.Lock()

def worm_seal(event: dict) -> str:
    with _worm_lock:
        event['ts'] = datetime.now(timezone.utc).isoformat()
        prev = ''
        if WORM_F.exists():
            lines = [l for l in WORM_F.read_text(encoding='utf-8').splitlines() if l.strip()]
            if lines:
                prev = json.loads(lines[-1]).get('seal', '')
        payload = json.dumps(event, sort_keys=True, ensure_ascii=False)
        seal    = hashlib.sha256((prev + payload).encode()).hexdigest()
        event['prev'] = prev[:16]
        event['seal'] = seal
        with open(WORM_F, 'a', encoding='utf-8') as f:
            f.write(json.dumps(event, ensure_ascii=False) + '\n')
        return seal

# ── LISP S-expression ─────────────────────────────────────────────────────────
def sexpr(*args) -> str:
    return '(' + ' '.join(str(a) for a in args) + ')'

# ── Load agents ───────────────────────────────────────────────────────────────
def load_agents() -> list:
    data = json.loads(AGENTS_F.read_text(encoding='utf-8'))
    return [a for a in data['agents'] if a.get('spawn', False)]

# ── ROBOB query ───────────────────────────────────────────────────────────────
def ask_robob(agent_id: str, query: str, use_tavily: bool = False) -> dict:
    try:
        body = json.dumps({'query': query, 'use_tavily': use_tavily}).encode()
        req  = urllib.request.Request(
            f'{ROBOB_URL}/oracle',
            data    = body,
            headers = {'Content-Type': 'application/json', 'X-Agent-Name': agent_id},
            method  = 'POST'
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception as e:
        return {'verdict': 'SILENCE', 'score': 0.0, 'seal': '', 'error': str(e)[:100]}

# ── State ─────────────────────────────────────────────────────────────────────
def load_state() -> dict:
    if STATE_F.exists():
        return json.loads(STATE_F.read_text(encoding='utf-8'))
    return {
        'tick':        0,
        'agents':      {},
        'events':      [],
        'murals':      [],
        'deeds':       [],
        'football':    {'team_alpha': 0, 'team_omega': 0, 'games_played': 0},
        'worm_count':  0,
    }

def save_state(state: dict):
    STATE_F.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding='utf-8')

def agent_state(state: dict, agent_id: str) -> dict:
    if agent_id not in state['agents']:
        state['agents'][agent_id] = {
            'id':        agent_id,
            'energy':    100,
            'resources': 50,
            'rep':       50,
            'frozen':    False,
            'deeds':     [],
            'actions':   0,
            'silences':  0,
            'violations': 0,
            'last_action': None,
        }
    return state['agents'][agent_id]

# ── ASCII Art (NOVA) ──────────────────────────────────────────────────────────
def nova_evidence(query: str, score: float) -> str:
    bar = '█' * int(score * 10) + '░' * (10 - int(score * 10))
    return (
        f"┌───────────────────────────────┐\n"
        f"│  ✅ EVIDENCE CONFIRMED         │\n"
        f"│  {query[:27]:<27} │\n"
        f"│  [{bar}] {score:.3f}  │\n"
        f"└───────────────────────────────┘"
    )

def nova_silence(query: str, score: float) -> str:
    return (
        f"┌───────────────────────────────┐\n"
        f"│  🔇 SILENCE PROTOCOL          │\n"
        f"│  {query[:27]:<27} │\n"
        f"│  [░░░░░░░░░░] {score:.3f}        │\n"
        f"│  No action. No execution.     │\n"
        f"└───────────────────────────────┘"
    )

def nova_event(event_type: str, detail: str) -> str:
    icons = {'TRADE': '💹', 'BUILD': '🔨', 'RULING': '⚖️', 'GOAL': '⚽',
             'MURAL': '🎨', 'SUMMON': '📜', 'VIOLATION': '🚨', 'BROADCAST': '📡'}
    icon  = icons.get(event_type, '🏙️')
    return (
        f"╔══════════════════════════════╗\n"
        f"║ {icon}  {event_type:<8} — CITY EVENT  ║\n"
        f"║ {detail[:29]:<29} ║\n"
        f"╚══════════════════════════════╝"
    )

def nova_goal(agent: str, team: str) -> str:
    return (
        f"\n  ⚽ ⚽ ⚽  G O A L !  ⚽ ⚽ ⚽\n"
        f"  {agent} scores for {team}!\n"
        f"  ████████ WORM SEALED ████████\n"
    )

def nova_civ_banner(state: dict) -> str:
    tick = state.get('tick', 0)
    agents = len(state.get('agents', {}))
    worm   = state.get('worm_count', 0)
    alpha  = state['football']['team_alpha']
    omega  = state['football']['team_omega']
    return (
        f"\n╔══════════════════════════════════════════╗\n"
        f"║     SnapKitty Digital Civilization       ║\n"
        f"║     Sims × Minecraft × Sovereign AI      ║\n"
        f"╠══════════════════════════════════════════╣\n"
        f"║  Tick      : {tick:<29}║\n"
        f"║  Citizens  : {agents:<29}║\n"
        f"║  WORM seals: {worm:<29}║\n"
        f"║  Football  : ALPHA {alpha} — OMEGA {omega}              ║\n"
        f"║  Oracle    : ROBOB (BOB + Live Web)       ║\n"
        f"║  Law       : Trust Deeds — immutable      ║\n"
        f"╚══════════════════════════════════════════╝"
    )

# ── Trust Deed ────────────────────────────────────────────────────────────────
def issue_deed(state: dict, agent_id: str, deed_type: str, detail: str) -> str:
    deed_id = f'DEED-{agent_id}-{deed_type}-{state["tick"]:04d}'
    deed = {
        'id':         deed_id,
        'agent':      agent_id,
        'type':       deed_type,
        'detail':     detail,
        'tick':       state['tick'],
    }
    seal = worm_seal({'event': 'TRUST_DEED', **deed})
    deed['seal'] = seal
    state['deeds'].append(deed_id)
    agent_state(state, agent_id)['deeds'].append(deed_id)
    with open(DEEDS_F, 'a', encoding='utf-8') as f:
        f.write(json.dumps(deed, ensure_ascii=False) + '\n')
    return deed_id

def freeze_agent(state: dict, agent_id: str, reason: str):
    ast = agent_state(state, agent_id)
    ast['frozen'] = True
    ast['violations'] += 1
    seal = worm_seal({'event': 'AGENT_FROZEN', 'agent': agent_id, 'reason': reason})
    print(f'  🔐 CIPHER: {agent_id} FROZEN — {reason} | seal:{seal[:12]}')

def unfreeze_agent(state: dict, agent_id: str, carto_verdict: str):
    ast = agent_state(state, agent_id)
    ast['frozen'] = False
    seal = worm_seal({'event': 'AGENT_UNFROZEN', 'agent': agent_id, 'verdict': carto_verdict})
    print(f'  ⚖️  CARTO: {agent_id} UNFROZEN — {carto_verdict} | seal:{seal[:12]}')

# ── Event generators ──────────────────────────────────────────────────────────
EVENTS = [
    {
        'type': 'TRADE',
        'gen': lambda a, b: {
            'actors':  [a['id'], b['id']],
            'sexpr':   sexpr('trade', a['id'], b['id'], 'resources', random.randint(5, 20)),
            'query':   f"Is a resource trade between {a['id']} and {b['id']} within Trust Deed limits?",
            'action':  lambda state, actors, r: _do_trade(state, actors[0], actors[1], r),
        }
    },
    {
        'type': 'BUILD',
        'gen': lambda a, b: {
            'actors':  [a['id']],
            'sexpr':   sexpr('build', a['id'], f'BLOCK-{random.randint(1,99)}', '"new-structure"'),
            'query':   f"Can {a['id']} build a new structure in the Vortex? Is the block unclaimed?",
            'action':  lambda state, actors, r: _do_build(state, actors[0], r),
        }
    },
    {
        'type': 'SUMMON',
        'gen': lambda a, b: {
            'actors':  ['CARTO', a['id']],
            'sexpr':   sexpr('summon', 'CARTO', a['id'], '"legal meeting — uniprise audit"'),
            'query':   f"Does CARTO have authority to summon {a['id']} for a legal audit under sovereign law?",
            'action':  lambda state, actors, r: _do_summon(state, actors[1], r),
        }
    },
    {
        'type': 'GOAL',
        'gen': lambda a, b: {
            'actors':  [a['id'], b['id']],
            'sexpr':   sexpr('play', a['id'], b['id'], 'football'),
            'query':   f"Validate football match event: {a['id']} vs {b['id']} — sovereign sport rules",
            'action':  lambda state, actors, r: _do_football(state, actors[0], r),
        }
    },
    {
        'type': 'BROADCAST',
        'gen': lambda a, b: {
            'actors':  ['RESONANCE'],
            'sexpr':   sexpr('shout', 'RESONANCE', '"∑∫ APL packet broadcast to all agents ∇∆"'),
            'query':   "What is the sovereign APL resonance protocol for agent communication?",
            'action':  lambda state, actors, r: _do_broadcast(state, r),
        }
    },
    {
        'type': 'MURAL',
        'gen': lambda a, b: {
            'actors':  ['NOVA'],
            'sexpr':   sexpr('paint', 'NOVA', f'WALL-{random.randint(1,20)}', '"city-event-mural"'),
            'query':   "Can NOVA the street artist paint a public mural on any unclaimed wall?",
            'action':  lambda state, actors, r: _do_mural(state, r),
        }
    },
]

def _do_trade(state, from_id, to_id, robob):
    amount = random.randint(5, 20)
    fa = agent_state(state, from_id)
    ta = agent_state(state, to_id)
    if fa['resources'] >= amount:
        fa['resources'] -= amount
        ta['resources'] += amount
        fa['rep'] += 2
        seal = worm_seal({'event': 'TRADE', 'from': from_id, 'to': to_id, 'amount': amount})
        print(f'  💹 TRADE: {from_id} → {to_id} | {amount} resources | seal:{seal[:12]}')
        return nova_event('TRADE', f'{from_id}→{to_id} {amount}res')

def _do_build(state, agent_id, robob):
    block_id = f'BLOCK-{random.randint(100, 999)}'
    agent_state(state, agent_id)['resources'] -= 10
    seal = worm_seal({'event': 'BUILD', 'agent': agent_id, 'block': block_id})
    print(f'  🔨 BUILD: {agent_id} claims {block_id} | seal:{seal[:12]}')
    return nova_event('BUILD', f'{agent_id} built {block_id}')

def _do_summon(state, agent_id, robob):
    seal = worm_seal({'event': 'SUMMON', 'summoned': agent_id, 'by': 'CARTO'})
    e2   = sexpr('speak', 'CARTO', agent_id, '"present your Uniprise records"')
    e3   = sexpr('speak', agent_id, 'CARTO', '"all records in order, sealed by CIPHER"')
    print(f'  📜 SUMMON: CARTO → {agent_id}')
    print(f'     {e2}')
    print(f'     {e3}')
    print(f'     seal:{seal[:12]}')
    return nova_event('SUMMON', f'CARTO summoned {agent_id}')

def _do_football(state, agent_id, robob):
    teams    = load_agents_raw()['football_teams']
    team     = 'TEAM_ALPHA' if agent_id in teams['TEAM_ALPHA'] else 'TEAM_OMEGA'
    team_key = 'team_alpha' if team == 'TEAM_ALPHA' else 'team_omega'
    state['football'][team_key] += 1
    state['football']['games_played'] += 1
    seal = worm_seal({'event': 'GOAL', 'scorer': agent_id, 'team': team})
    print(nova_goal(agent_id, team))
    print(f'     seal:{seal[:12]}')
    return nova_event('GOAL', f'{agent_id} SCORES!')

def _do_broadcast(state, robob):
    seal  = worm_seal({'event': 'APL_BROADCAST', 'from': 'RESONANCE'})
    apl   = '∑∫∇∆ (λx.∀agents: (robob-query x)) ⊗'
    print(f'  📡 RESONANCE BROADCAST: {apl}')
    print(f'     seal:{seal[:12]}')
    return nova_event('BROADCAST', 'RESONANCE APL packet')

def _do_mural(state, robob):
    mural = nova_event('MURAL', f'NOVA painted wall @ tick {state["tick"]}')
    wall  = f'WALL-{random.randint(1,20)}'
    seal  = worm_seal({'event': 'MURAL', 'artist': 'NOVA', 'wall': wall})
    with open(MURALS_F, 'a', encoding='utf-8') as f:
        f.write(json.dumps({'wall': wall, 'mural': mural, 'seal': seal}, ensure_ascii=False) + '\n')
    print(f'  🎨 NOVA painted {wall} | seal:{seal[:12]}')
    return mural

_agents_raw_cache = None
def load_agents_raw() -> dict:
    global _agents_raw_cache
    if not _agents_raw_cache:
        _agents_raw_cache = json.loads(AGENTS_F.read_text(encoding='utf-8'))
    return _agents_raw_cache

# ── Tick ──────────────────────────────────────────────────────────────────────
def run_tick(state: dict, agents: list, verbose: bool = True):
    state['tick'] += 1
    tick = state['tick']
    if verbose:
        print(f'\n{"─"*56}')
        print(f'  TICK {tick:04d} — {datetime.now().strftime("%H:%M:%S")}')
        print(f'{"─"*56}')

    # Pick event type
    event_cfg  = random.choice(EVENTS)
    alive      = [a for a in agents if not agent_state(state, a['id']).get('frozen')]
    if len(alive) < 2:
        print('  ⚠️  Not enough active agents for a tick')
        return

    actor_a = random.choice(alive)
    actor_b = random.choice([a for a in alive if a['id'] != actor_a['id']])
    ev      = event_cfg['gen'](actor_a, actor_b)
    etype   = event_cfg['type']

    # Print LISP envelope
    print(f'  {ev["sexpr"]}')

    # Query ROBOB
    primary_actor = ev['actors'][0]
    robob_result  = ask_robob(primary_actor, ev['query'])
    verdict = robob_result.get('verdict', 'SILENCE')
    score   = robob_result.get('score', 0.0)
    seal    = robob_result.get('seal', '')[:16]

    print(f'  ROBOB → {verdict} | score:{score:.4f} | seal:{seal}')

    mural = None
    if verdict == 'EVIDENCE':
        mural = ev['action'](state, ev['actors'], robob_result)
        agent_state(state, primary_actor)['actions'] += 1
    else:
        agent_state(state, primary_actor)['silences'] += 1
        print(f'  🔇 SILENCE — {primary_actor} action blocked. No execution.')
        mural = nova_silence(ev['query'][:27], score)

        # PHANTOM violation check — 3+ silences = suspicious
        ast = agent_state(state, primary_actor)
        if ast['silences'] >= 3 and not ast['frozen']:
            print(f'  👁️  PHANTOM: {primary_actor} flagged — {ast["silences"]} silences')
            print(f'     {sexpr("report", "PHANTOM", "CARTO", f'"repeated SILENCE violations: {primary_actor}"')}')

    # Drain energy
    for a in ev['actors']:
        ast = agent_state(state, a)
        ast['energy'] = max(0, ast['energy'] - random.randint(2, 8))
        # GRANITE3 restores energy for all
        if random.random() < 0.2:
            ast['energy'] = min(100, ast['energy'] + 15)

    # Record event
    ev_record = {
        'tick':    tick,
        'type':    etype,
        'actors':  ev['actors'],
        'verdict': verdict,
        'score':   score,
        'seal':    seal,
        'sexpr':   ev['sexpr'],
    }
    state['events'] = (state['events'] + [ev_record])[-50:]  # keep last 50

    if mural:
        state['murals'] = (state['murals'] + [mural])[-10:]

    state['worm_count'] = sum(1 for _ in (WORM_F.read_text(encoding='utf-8').splitlines() if WORM_F.exists() else []) if _.strip())
    save_state(state)

# ── Demo scenario — CARTO summons FORGE over block dispute ────────────────────
def run_demo():
    print(nova_civ_banner({'tick': 0, 'agents': {}, 'worm_count': 0,
                           'football': {'team_alpha': 0, 'team_omega': 0, 'games_played': 0}}))
    print('\n  ═══ DEMO: CARTO SUMMONS FORGE — Block C3 Dispute ═══\n')

    convo = [
        ('CARTO',     sexpr('summon', 'CARTO', 'FORGE', '"explain construction claim on block C3"')),
        ('FORGE',     sexpr('speak', 'FORGE', 'CARTO', '"I built the foundation. Land is mine by labor."')),
        ('FLUX',      sexpr('speak', 'FLUX', 'CARTO', '"C3 is my trading post. FORGE violated the boundary."')),
        ('ROBOB',     sexpr('invoke', 'ROBOB', '"sovereign land ownership rules in the civilization"')),
        ('CIPHER',    sexpr('rule', 'CARTO', 'FORGE', 'SILENCE', '"DEED-C3-FLUX-001"')),
        ('WORM',      sexpr('seal', 'WORM', '"DEED-C3-FLUX-001"')),
        ('NOVA',      sexpr('paint', 'NOVA', '"WALL-C3"', '"CARTO has spoken — DEED upheld"')),
    ]

    for speaker, line in convo:
        time.sleep(0.4)
        print(f'  [{speaker:8}] {line}')

    print()
    r = ask_robob('CARTO', 'sovereign land ownership rules in the civilization')
    print(nova_evidence('sovereign land rules', r.get('score', 0.71)) if r.get('verdict') == 'EVIDENCE'
          else nova_silence('sovereign land rules', r.get('score', 0.0)))

    seal = worm_seal({'event': 'DEMO_DISPUTE', 'deed': 'DEED-C3-FLUX-001', 'verdict': 'FLUX wins C3'})
    print(f'\n  WORM SEAL: {seal[:32]}...\n')
    print(nova_event('RULING', 'FLUX keeps C3 — CARTO ruled'))
    print(nova_goal('RESONANCE', 'TEAM_ALPHA'))

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    args = sys.argv[1:]

    if '--demo' in args:
        run_demo()
        sys.exit(0)

    agents = load_agents()
    state  = load_state()

    if '--once' in args:
        run_tick(state, agents)
        print(nova_civ_banner(state))
        sys.exit(0)

    print(nova_civ_banner(state))
    print(f'\n  {len(agents)} agents active. Civilization running. Ctrl+C to stop.\n')

    try:
        while True:
            run_tick(state, agents)
            time.sleep(TICK_SEC)
    except KeyboardInterrupt:
        print('\n\n  Civilization paused. State saved.')
        print(nova_civ_banner(state))
