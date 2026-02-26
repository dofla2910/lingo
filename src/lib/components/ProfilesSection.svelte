<script>
  import {
    calculateAge,
    ELEMENT_META,
    fallbackFlamingoAvatar,
    formatDate,
    GENDER_LABELS,
    getWesternZodiac,
    parseDate,
  } from "../lingo/utils.js";

  export let state;
  export let now = Date.now();

  const fallbackAvatar = fallbackFlamingoAvatar(120);

  function getAvatar(person) {
    return person?.avatarUrl?.trim() || fallbackAvatar;
  }

  function onImgError(event) {
    if (event?.currentTarget) event.currentTarget.src = fallbackAvatar;
  }

  $: today = new Date(now);
  $: people = [
    { key: "personA", title: "Người 1", data: state?.couple?.personA || {} },
    { key: "personB", title: "Người 2", data: state?.couple?.personB || {} },
  ].map((item) => {
    const birthday = parseDate(item.data?.birthday || "");
    const zodiac = getWesternZodiac(birthday);
    const age = calculateAge(birthday, today);
    return {
      ...item,
      birthday,
      zodiac,
      age,
      elementMeta: zodiac ? ELEMENT_META[zodiac.element] : null,
    };
  });
</script>

<section class="card rounded-3xl p-4 sm:p-5">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Svelte • Cặp đôi</p>
      <h2 class="text-lg sm:text-xl font-bold text-[color:var(--ink)]">Hồ sơ tình yêu của hai bạn</h2>
      <p class="text-sm text-[color:var(--ink2)]">Dữ liệu hồ sơ được đọc trực tiếp từ Supabase (PostgreSQL + Realtime).</p>
    </div>
  </div>

  <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
    {#each people as person}
      <article class="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm shadow-pink-200/40">
        <div class="flex items-start gap-3">
          <img
            src={getAvatar(person.data)}
            alt={`Avatar ${person.data?.name || person.title}`}
            class="h-16 w-16 rounded-2xl object-cover border border-pink-200/80 bg-white"
            on:error={onImgError}
          />
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold text-pink-500">{person.title}</p>
            <h3 class="truncate text-lg font-bold text-[color:var(--ink)]">{person.data?.name || person.title}</h3>
            <p class="text-sm text-[color:var(--ink2)]">
              {GENDER_LABELS[person.data?.gender] || "Không tiết lộ"}
            </p>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-xl border border-white/80 bg-white/70 p-3">
            <p class="text-xs uppercase tracking-[.12em] text-[color:var(--ink2)]">Ngày sinh</p>
            <p class="mt-1 font-semibold text-[color:var(--ink)]">
              {person.birthday ? formatDate(person.birthday) : "Chưa thiết lập"}
            </p>
          </div>
          <div class="rounded-xl border border-white/80 bg-white/70 p-3">
            <p class="text-xs uppercase tracking-[.12em] text-[color:var(--ink2)]">Tuổi</p>
            <p class="mt-1 font-semibold text-[color:var(--ink)]">
              {person.age !== null ? `${person.age} tuổi` : "—"}
            </p>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center rounded-full border border-pink-200/80 bg-pink-50 px-2.5 py-1 text-xs font-semibold text-pink-700">
            {person.zodiac ? `✦ ${person.zodiac.name}` : "✦ Chưa có cung"}
          </span>
          {#if person.elementMeta}
            <span
              class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border border-white/80"
              style={`color:${person.elementMeta.color};background:${person.elementMeta.bg};`}
            >
              {person.elementMeta.label}
            </span>
          {/if}
        </div>
      </article>
    {/each}
  </div>
</section>
