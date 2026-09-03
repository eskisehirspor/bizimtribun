/** Build regex fragments that survive Turkish diacritics after our lowercase fold. */
export function trClass(input: string) {
  let out = "";
  for (const ch of input) {
    switch (ch) {
      case "c":
        out += "[cç]";
        break;
      case "g":
        out += "[gğ]";
        break;
      case "i":
        out += "[iı]";
        break;
      case "o":
        out += "[oö]";
        break;
      case "s":
        out += "[sş]";
        break;
      case "u":
        out += "[uü]";
        break;
      default:
        out += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return out;
}

function altBody(forms: string[]) {
  const unique = [...new Set(forms.map((f) => f.trim()).filter(Boolean))];
  return unique.map(trClass).join("|");
}

/** Whole-token match on normalized, compact, and aggressive haystacks. */
export function bounded(forms: string[]) {
  const body = altBody(forms);
  return new RegExp(`(^|[^a-z0-9])(?:${body})([^a-z0-9]|$)`, "i");
}

/** Leading token bound only — catches "o r o s p u gibi" after compacting. */
export function leadingBounded(forms: string[]) {
  const body = altBody(forms);
  return new RegExp(`(^|[^a-z0-9])(?:${body})`, "i");
}

export function boundedPhrase(partsList: string[][]) {
  const forms: string[] = [];
  for (const parts of partsList) {
    forms.push(parts.join(" "));
    forms.push(parts.join(""));
  }
  return bounded(forms);
}
