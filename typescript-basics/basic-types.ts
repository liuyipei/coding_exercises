/**
 * Goal: practice annotating basic types and optional values.
 * Scenario: a tiny search bar that can hide/show and track the current input.
 * TODO: add the missing type annotations so TypeScript understands the shapes below.
 */

// TODO: give these parameters proper types (hint: visible is boolean, searchInput can be string or null).
function toggleSearch(visible /* TODO */, searchInput /* TODO */) /* TODO: return type */ {
  // When the search is hidden, clear the input by default.
  const nextInput = visible ? searchInput : null;

  return {
    visible,
    searchInput: nextInput,
  };
}

// Example usage: try changing the arguments and see where types break once you fill TODOs.
const initialState = toggleSearch(true, 'hello');
console.log('Initial state', initialState);
