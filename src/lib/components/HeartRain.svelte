<script>
  import { onDestroy } from "svelte";

  const HEARTS = ["❤", "💗", "💖", "💕", "💓"];
  let items = [];
  let seq = 0;
  const cleanupTimers = new Set();

  function random(min, max) {
    return Math.random() * (max - min) + min;
  }

  export function burst(count = 14) {
    if (typeof window === "undefined") return;
    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (prefersReduced) return;

    const now = Date.now();
    const next = [];
    for (let i = 0; i < count; i += 1) {
      seq += 1;
      const life = random(1.5, 2.6);
      const delay = random(0, 0.28);
      const left = random(8, 92);
      const drift = random(-46, 46);
      const size = random(16, 30);
      const rotate = random(-25, 25);
      next.push({
        id: `${now}-${seq}`,
        symbol: HEARTS[Math.floor(Math.random() * HEARTS.length)],
        left,
        drift,
        delay,
        life,
        size,
        rotate,
      });
    }
    items = [...items, ...next];

    const longest = Math.ceil((Math.max(...next.map((v) => v.life + v.delay)) + 0.25) * 1000);
    const timer = window.setTimeout(() => {
      const dead = new Set(next.map((v) => v.id));
      items = items.filter((v) => !dead.has(v.id));
      cleanupTimers.delete(timer);
    }, longest);
    cleanupTimers.add(timer);
  }

  onDestroy(() => {
    cleanupTimers.forEach((timer) => clearTimeout(timer));
    cleanupTimers.clear();
  });
</script>

<div class="heart-rain-layer" aria-hidden="true">
  {#each items as item (item.id)}
    <span
      class="heart-drop"
      style={`left:${item.left}%;--drift:${item.drift}px;--delay:${item.delay}s;--dur:${item.life}s;--size:${item.size}px;--rot:${item.rotate}deg;`}
    >
      {item.symbol}
    </span>
  {/each}
</div>

<style>
  .heart-rain-layer {
    position: fixed;
    inset: 0;
    z-index: 52;
    pointer-events: none;
    overflow: hidden;
  }

  .heart-drop {
    position: absolute;
    bottom: -1.4rem;
    font-size: var(--size, 20px);
    line-height: 1;
    opacity: 0;
    filter: drop-shadow(0 6px 10px rgba(255, 106, 156, 0.26));
    animation-name: heartRise;
    animation-duration: var(--dur, 2s);
    animation-delay: var(--delay, 0s);
    animation-timing-function: cubic-bezier(0.21, 0.68, 0.24, 1);
    animation-fill-mode: forwards;
    transform: translateX(-50%) rotate(var(--rot, 0deg));
  }

  @keyframes heartRise {
    0% {
      opacity: 0;
      transform: translateX(-50%) translateY(0) rotate(var(--rot, 0deg)) scale(0.7);
    }
    12% {
      opacity: 0.95;
    }
    100% {
      opacity: 0;
      transform: translateX(calc(-50% + var(--drift, 0px))) translateY(-78vh) rotate(calc(var(--rot, 0deg) + 16deg)) scale(1.18);
    }
  }
</style>
