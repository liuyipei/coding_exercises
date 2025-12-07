/**
 * Goal: define simple interfaces and use a generic helper.
 * Scenario: track search state changes and log them.
 * TODO: fill in interfaces and generic parameter types.
 */

// TODO: create an interface for search state with `visible: boolean` and `query: string`.
interface SearchState /* TODO */ {}

// A generic helper that reports state transitions.
// TODO: add a type parameter and use it for both `previous` and `next`.
function trackChange(/* TODO: type parameter here */ previous, /* TODO */ next) {
  console.log('Changed from', previous, 'to', next);
  return next;
}

// TODO: add the missing type annotation for the state variable.
let currentState /* TODO */ = { visible: true, query: 'hello' };

// Simulate a change.
currentState = trackChange(currentState, { visible: false, query: 'goodbye' });
