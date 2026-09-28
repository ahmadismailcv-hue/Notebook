const GROUPS: [string, string][] = [
  ['Frequent', '📓 📔 📒 📕 📗 📘 📙 📄 📝 📁 📂 🗂️ 📌 📍 📎 🔖 🏷️ 💡 ⭐ 🔥 ✅ ☑️ 🎯 🚀'],
  ['Work', '💼 📊 📈 📉 🗓️ 📅 ⏰ 🧮 🖥️ 💻 ⌨️ 🖱️ 📱 🎥 🎬 🎙️ 🎧 📷 📸 🧾 💰 💳 🏦 📦 ✉️ 📣 📢'],
  ['Mind', '🧠 💭 💬 🗯️ 🤔 🧐 📚 📖 🎓 🔬 🔭 🧪 🧬 ⚙️ 🛠️ 🔧 🔨 🧩 ♟️ 🎨 🖌️ ✏️ 🖊️ ✒️'],
  ['Life', '🏠 🏡 🌱 🌿 🌳 🌸 🌻 🌙 ☀️ 🌈 ☕ 🍵 🍎 🥑 🍳 🏃 🧘 🏋️ ⚽ 🎮 🎵 🎸 ✈️ 🗺️ 🧳 🏖️ ⛰️ 🚗'],
  ['Symbols', '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 ⚡ ✨ 💎 🔑 🔒 🛡️ ⚠️ ❗ ❓ ➕ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪'],
]

export const ALL_EMOJI = GROUPS.flatMap(([, s]) => s.split(' '))

export function EmojiPicker({ onPick, onRemove, close }: { onPick: (e: string) => void; onRemove?: () => void; close: () => void }) {
  const pick = (e: string) => {
    onPick(e)
    close()
  }
  return (
    <div className="emoji-picker">
      <div className="emoji-actions">
        <button className="chip" onClick={() => pick(ALL_EMOJI[Math.floor(Math.random() * ALL_EMOJI.length)])}>
          🎲 Random
        </button>
        {onRemove && (
          <button
            className="chip"
            onClick={() => {
              onRemove()
              close()
            }}
          >
            Remove
          </button>
        )}
      </div>
      <div className="emoji-scroll">
        {GROUPS.map(([name, list]) => (
          <section key={name}>
            <div className="emoji-group">{name}</div>
            <div className="emoji-grid">
              {list.split(' ').map((e) => (
                <button key={e} className="emoji-btn" onClick={() => pick(e)} aria-label={e}>
                  {e}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
