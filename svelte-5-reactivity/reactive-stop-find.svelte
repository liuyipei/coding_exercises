<script lang="ts">
  let visible = true;
  let searchInput: string | null = null;

  async function stopFind(): Promise<void> {
    // Pretend this calls window.findInPage('stop') or similar.
    // In a real app, this would talk to the host environment.
    console.log('Stopping find operation...');
  }

  // INCORRECT version (for discussion only):
  // $: if (!visible && searchInput) {
  //   await stopFind();
  // }

  // TODO: write the CORRECT version that keeps the reactive graph synchronous.
  // - Do not `await` inside the reactive statement.
  // - Use a fire-and-forget pattern.
  // - Make it clear this block should remain synchronous and declarative.
  // Hint: use `void stopFind();`.
  $: if (!visible && searchInput) {
    // Reactive statements are meant to run synchronously; awaiting here can serialize updates,
    // stall DOM work, or reorder relative to other changes.
    // Fire-and-forget expresses that the side effect should not block reactivity.
    // TODO: replace the line below with `void stopFind();`
    // await stopFind();
  }

  function toggleVisibility() {
    visible = !visible;
  }

  function setInput(value: string | null) {
    searchInput = value;
  }
</script>

<button on:click={toggleVisibility}>
  Toggle search (currently {visible ? 'shown' : 'hidden'})
</button>
<button on:click={() => setInput('docs')}>Set input to "docs"</button>
<button on:click={() => setInput(null)}>Clear input</button>

<!--
  Consider race conditions:
  - If `visible` flips rapidly, multiple `stopFind()` calls may overlap; make `stopFind()` safe to call repeatedly.
  - For advanced learners, an edge-triggered pattern could be:
    $: if ($previous(visible) && !visible) {
         void stopFind();
       }
  - Keep reactive statements synchronous; treat Promises as side effects started from them, not awaited within them.
-->
