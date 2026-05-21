export function formatPetServiceTitle(input: {
  petNames: string[];
  serviceName: string;
}) {
  const pets = input.petNames.map((name) => name.trim()).filter(Boolean).join(", ");
  return `${pets || "Sem pet vinculado"} - ${input.serviceName}`;
}
