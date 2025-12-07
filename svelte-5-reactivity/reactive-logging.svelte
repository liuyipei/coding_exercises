<script lang="ts">
  let visible = true;
  let searchInput: string = '';

  // TODO: write a reactive block that logs whenever `visible` or `searchInput` changes.
  // Hint: use `$:` with a block.
  // $: {
  //   console.log('visibility or input changed', { visible, searchInput });
  // }

  function toggle() {
    visible = !visible;
  }

  function updateInput(event: Event) {
    const target = event.target as HTMLInputElement;
    searchInput = target.value;
  }
</script>

<button on:click={toggle}>Toggle search ({visible ? 'shown' : 'hidden'})</button>
<input placeholder="Type to search" value={searchInput} on:input={updateInput} />

<!--
  Notes:
  - This is similar to "subscribing" to state changes. `$:` blocks run synchronously after assignments.
  - Keep side effects small and predictable; avoid async operations here unless you intentionally trigger them fire-and-forget.
-->
