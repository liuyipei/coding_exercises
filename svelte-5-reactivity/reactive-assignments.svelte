<script lang="ts">
  let count = 0;

  // TODO: make `doubled` automatically update whenever `count` changes.
  // Hint: use a reactive assignment with `$:`.
  // $: doubled = count * 2;
  let doubled; // intentionally untyped for the exercise

  function increment() {
    count += 1;
  }
</script>

<button on:click={increment}>
  Count: {count}
</button>
<p>Doubled: {doubled}</p>

<!--
  Notes:
  - `$:` reruns when its dependencies change. Here, that means whenever `count` changes.
  - Derived values should be synchronous and side-effect free; reactive assignments are great for computed values.
-->
