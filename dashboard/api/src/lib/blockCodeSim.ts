/// A server-side `block_code` interpreter, used only to check that an authored
/// `reference_solution` actually solves its level.
///
/// ## Why a second interpreter exists
///
/// The playable one is Dart, in `app_main/lib/features/games/engine/
/// block_code_engine.dart`. Two implementations of the same semantics can drift,
/// which is a real risk and is why `test/blockCodeSim.test.mjs` and
/// `app_main/test/wave_two_engines_test.dart` are both driven by the same fixture
/// file, `docs/games/fixtures/block_code_cases.json`. If the two ever disagree, one
/// of the two suites fails.
///
/// The alternative was to leave `reference_solution` unchecked. That solution is
/// what the fourth help rung plays for a child who is stuck four times over, so an
/// authored solution that walks into a wall turns the help ladder into a
/// demonstration of failure. Worth a second interpreter.
///
/// ## Semantics
///
/// Identical to the Dart engine, including the two documented readings of the flat
/// program array: `repeat:n` repeats the single following block, and `if_path`
/// guards the single following block.

export interface BlockGridSpec {
  width: number;
  height: number;
  start: [number, number];
  goal: [number, number];
  facing: string;
  walls: [number, number][];
  collectibles: [number, number][];
}

export interface BlockOutcome {
  x: number;
  y: number;
  facing: string;
  collected: number;
  collided: boolean;
  reachedGoal: boolean;
  steps: number;
}

const FACINGS = ['north', 'east', 'south', 'west'] as const;

interface ParsedBlock {
  kind: string;
  count: number;
}

function parse(token: string): ParsedBlock | null {
  const [kind, rawCount] = token.split(':');
  if (!kind) return null;
  const count = rawCount === undefined ? 2 : Number.parseInt(rawCount, 10);
  return { kind, count: Number.isFinite(count) ? count : 2 };
}

/// Runs [tokens] over [grid], with an optional `function` body.
export function runBlockProgram(
  grid: BlockGridSpec,
  tokens: string[],
  functionTokens: string[] = [],
  maxSteps = 500,
): BlockOutcome {
  let x = grid.start[0];
  let y = grid.start[1];
  let facingIndex = Math.max(0, FACINGS.indexOf(grid.facing as typeof FACINGS[number]));
  const collected = new Set<string>();
  let collided = false;
  let steps = 0;

  const isWall = (cx: number, cy: number) =>
    grid.walls.some(([wx, wy]) => wx === cx && wy === cy);
  const blocked = (cx: number, cy: number) =>
    cx < 0 || cy < 0 || cx >= grid.width || cy >= grid.height || isWall(cx, cy);

  const ahead = (): [number, number] => {
    switch (FACINGS[facingIndex]) {
      case 'north': return [x, y - 1];
      case 'south': return [x, y + 1];
      case 'east': return [x + 1, y];
      default: return [x - 1, y];
    }
  };

  const body = functionTokens.map(parse).filter((b): b is ParsedBlock => b !== null);

  const execute = (blocks: ParsedBlock[]) => {
    for (let i = 0; i < blocks.length; i++) {
      if (collided || steps >= maxSteps) return;
      const block = blocks[i];
      switch (block.kind) {
        case 'move': {
          const [nx, ny] = ahead();
          steps++;
          if (blocked(nx, ny)) { collided = true; return; }
          x = nx;
          y = ny;
          break;
        }
        case 'turn_left':
          facingIndex = (facingIndex + 3) % 4;
          steps++;
          break;
        case 'turn_right':
          facingIndex = (facingIndex + 1) % 4;
          steps++;
          break;
        case 'collect':
          steps++;
          if (grid.collectibles.some(([cx, cy]) => cx === x && cy === y)) {
            collected.add(`${x},${y}`);
          }
          break;
        case 'repeat': {
          if (i + 1 >= blocks.length) { steps++; break; }
          const repeated = [blocks[i + 1]];
          for (let r = 0; r < block.count; r++) {
            if (collided || steps >= maxSteps) break;
            execute(repeated);
          }
          i++;
          break;
        }
        case 'if_path': {
          if (i + 1 >= blocks.length) { steps++; break; }
          const [nx, ny] = ahead();
          if (!blocked(nx, ny)) execute([blocks[i + 1]]);
          else steps++;
          i++;
          break;
        }
        case 'function':
          execute(body);
          break;
        default:
          // An unknown token is a validation failure elsewhere; here it is a no-op
          // rather than a crash, so one bad token does not hide the rest.
          steps++;
      }
    }
  };

  execute(tokens.map(parse).filter((b): b is ParsedBlock => b !== null));

  const reachedGoal = !collided
    && x === grid.goal[0]
    && y === grid.goal[1]
    && collected.size >= grid.collectibles.length;

  return {
    x,
    y,
    facing: FACINGS[facingIndex],
    collected: collected.size,
    collided,
    reachedGoal,
    steps,
  };
}
