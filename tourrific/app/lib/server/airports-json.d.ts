// airports-json ships without types. Every field is a string; missing values are "".
declare module "airports-json" {
  const data: { airports: Record<string, string>[] };
  export default data;
}
