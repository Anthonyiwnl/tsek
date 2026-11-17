import axe from 'axe-core';

// WCAG 2.1 A and AA rules, the same checks as Lighthouse's accessibility
// audit. jsdom has no layout, so axe cannot measure colour contrast here;
// Lighthouse CI checks contrast on the built pages instead.
const options: axe.RunOptions = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  rules: { 'color-contrast': { enabled: false } },
};

/** Returns one readable line per violation; an empty list means the screen passed. */
export async function accessibilityViolations(container: Element = document.body): Promise<string[]> {
  const result = await axe.run(container, options);
  return result.violations.map(violation =>
    `${violation.id} (${violation.impact}): ${violation.help} at ${violation.nodes.map(node => node.target.join(' ')).join(', ')}`);
}
