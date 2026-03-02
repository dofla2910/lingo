<script>
  import { createEventDispatcher } from "svelte";

  export let disabled = false;
  export let busy = false;

  const dispatch = createEventDispatcher();
  let pressed = false;

  function handleClick() {
    if (disabled || busy) return;
    pressed = true;
    window.setTimeout(() => {
      pressed = false;
    }, 140);
    dispatch("ping");
  }
</script>

<button
  class={`heartbeat-btn ${pressed ? "pressed" : ""}`}
  type="button"
  on:click={handleClick}
  disabled={disabled || busy}
  aria-label="Nút chạm gửi nhịp yêu thương"
>
  <span class="heartbeat-icon-wrap" aria-hidden="true">
    <svg class="heartbeat-icon" viewBox="0 0 24 24" fill="none" role="img" aria-label="Trái tim">
      <path
        d="M12 21.5l-1.35-1.23C5.52 15.59 2 12.36 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09A5.96 5.96 0 0 1 16.5 3C19.58 3 22 5.42 22 8.5c0 3.86-3.52 7.09-8.65 11.77L12 21.5Z"
        fill="url(#heartbeatGradient)"
      />
      <defs>
        <linearGradient id="heartbeatGradient" x1="2" y1="3" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FF9FBF" />
          <stop offset="1" stop-color="#FF5D92" />
        </linearGradient>
      </defs>
    </svg>
  </span>
  <span class="heartbeat-text">{busy ? "Đang gửi..." : "Nút chạm"}</span>
</button>

<style>
  .heartbeat-btn {
    width: 100%;
    min-height: 5rem;
    border-radius: 1.25rem;
    border: 1px solid rgba(255, 144, 186, 0.5);
    background:
      radial-gradient(circle at 20% 18%, rgba(255, 255, 255, 0.8), transparent 42%),
      linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 224, 239, 0.9));
    box-shadow: 0 14px 28px rgba(255, 118, 166, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    font-weight: 800;
    color: var(--ink);
    transition: transform 0.14s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  }

  .heartbeat-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: rgba(255, 120, 170, 0.62);
    box-shadow: 0 18px 34px rgba(255, 118, 166, 0.24);
  }

  .heartbeat-btn.pressed:not(:disabled) {
    transform: scale(0.97);
  }

  .heartbeat-btn:disabled {
    opacity: 0.62;
    cursor: not-allowed;
  }

  .heartbeat-icon-wrap {
    width: 2.05rem;
    height: 2.05rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    animation: heartbeatPulse 1.2s ease-in-out infinite;
  }

  .heartbeat-icon {
    width: 100%;
    height: 100%;
    filter: drop-shadow(0 6px 10px rgba(255, 110, 158, 0.36));
  }

  .heartbeat-text {
    font-size: 1rem;
    letter-spacing: 0.02em;
  }

  @keyframes heartbeatPulse {
    0%, 100% {
      transform: scale(1);
    }
    30% {
      transform: scale(1.12);
    }
    60% {
      transform: scale(0.94);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .heartbeat-btn,
    .heartbeat-icon-wrap {
      transition: none;
      animation: none;
    }
  }
</style>
