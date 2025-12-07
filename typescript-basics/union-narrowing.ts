/**
 * Goal: practice union types and type narrowing.
 * Scenario: decide what the UI should do based on visibility and search input.
 * TODO: annotate parameters and narrow `searchInput` safely.
 */

// TODO: add types so `visible` is boolean and `searchInput` is string | null.
function describeSearch(/* TODO: visible type */, /* TODO: searchInput type */) {
  if (!visible) {
    return 'Search is hidden; nothing to do.';
  }

  // TODO: narrow searchInput so TypeScript knows it's a string here.
  if (searchInput /* TODO: add a check */) {
    return `Search for "${searchInput}"`;
  }

  return 'Search is visible but empty.';
}

const result = describeSearch(true, 'svelte');
console.log(result);
