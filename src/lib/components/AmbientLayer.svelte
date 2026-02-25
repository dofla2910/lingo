<script>
  const pieces = Array.from({ length: 18 }, (_, i) => {
    const heart = i % 4 !== 0;
    return {
      id: i,
      kind: heart ? "heart" : "bird",
      char: heart ? (i % 3 === 0 ? "♡" : "♥") : "🦩",
      left: `${4 + ((i * 7) % 92)}%`,
      delay: `${-(i * 1.15)}s`,
      duration: `${14 + (i % 7) * 2}s`,
      dx: `${(i % 2 === 0 ? 1 : -1) * (10 + (i % 5) * 6)}vw`,
      rot: `${(i % 2 === 0 ? 1 : -1) * (8 + (i % 6) * 6)}deg`,
      scale: `${0.7 + (i % 5) * 0.12}`,
      opacity: `${heart ? 0.16 + (i % 3) * 0.04 : 0.18 + (i % 2) * 0.06}`,
      size: heart ? `${14 + (i % 4) * 4}px` : `${15 + (i % 3) * 4}px`,
    };
  });
</script>

<div class="ambient" aria-hidden="true">
  {#each pieces as p}
    <span
      class={`float ${p.kind === "heart" ? "heart" : ""}`}
      style={`left:${p.left};animation-duration:${p.duration};animation-delay:${p.delay};--dx:${p.dx};--r:${p.rot};--s:${p.scale};--o:${p.opacity};font-size:${p.size};`}
    >
      {p.char}
    </span>
  {/each}
</div>

