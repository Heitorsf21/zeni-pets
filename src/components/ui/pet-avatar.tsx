const colors = ["avatar--teal", "avatar--lilac", "avatar--warm", "avatar--rose"];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function PetAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" | "xl" }) {
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`avatar ${color} ${size === "lg" ? "avatar--lg" : ""} ${size === "xl" ? "avatar--xl" : ""}`}>
      {initials(name)}
    </div>
  );
}

export function PetRow({ name, breed }: { name: string; breed: string }) {
  return (
    <div className="pet-row">
      <PetAvatar name={name} />
      <div>
        <div className="pet-row__name">{name}</div>
        <div className="pet-row__sub">{breed}</div>
      </div>
    </div>
  );
}
