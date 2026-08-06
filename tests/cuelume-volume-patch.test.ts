import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Guards the patch-package boost in patches/cuelume+*.patch: the sounds this
// site plays must stay at full masterGain. If a cuelume upgrade or a dropped
// postinstall ever loses the patch, this fails instead of silently shipping
// the stock (much quieter) 0.4 levels.
const PATCHED_SOUNDS = ['tick', 'press', 'toggle'];

describe('cuelume volume patch', () => {
  const recipes = readFileSync(
    join(process.cwd(), 'node_modules/cuelume/dist/sounds/recipes.js'),
    'utf8',
  );

  for (const sound of PATCHED_SOUNDS) {
    it(`${sound} has masterGain 1.0`, () => {
      const match = recipes.match(
        new RegExp(`${sound}: \\{\\s*masterGain: ([\\d.]+)`),
      );
      expect(match, `recipe for "${sound}" not found`).not.toBeNull();
      expect(Number(match![1])).toBe(1.0);
    });
  }
});
