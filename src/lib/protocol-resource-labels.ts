type ProtocolResourceStep = {
  materials: string[];
  equipment: string[];
};

type ProtocolResourceContainer = {
  materials: string[];
  equipment: string[];
  steps: ProtocolResourceStep[];
};

const INLINE_SOURCE_REFS_SUFFIX =
  /\s*(?:\(\s*)?source[\s_-]*refs\s*[:=]\s*\[([^\]\r\n]*)\]\s*\)?\s*[.,;:]?\s*$/iu;
const UUID_REFERENCE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const PREFIXED_REFERENCE =
  /^(?:source|artifact|excerpt)[-_:][a-z0-9][a-z0-9._:-]*$/iu;

function isInternalReferenceList(value: string): boolean {
  const references = value
    .split(",")
    .map((item) => item.trim().replace(/^(['"])(.*)\1$/u, "$2"))
    .filter(Boolean);

  return (
    references.length > 0 &&
    references.every(
      (reference) =>
        UUID_REFERENCE.test(reference) ||
        PREFIXED_REFERENCE.test(reference),
    )
  );
}

/**
 * Removes internal citation metadata that an AI response may have appended to
 * a user-facing material or equipment label.
 *
 * Real citations live in the protocol's structured SourceRef[] fields. This
 * helper deliberately removes only a trailing `sourceRefs: [...]` annotation,
 * leaving normal parentheses, catalogue numbers, concentrations, and units
 * untouched.
 */
export function stripInlineSourceRefs(value: string): string {
  let cleaned = value.trim();

  for (let index = 0; index < 4; index += 1) {
    const match = INLINE_SOURCE_REFS_SUFFIX.exec(cleaned);
    if (!match || !isInternalReferenceList(match[1] ?? "")) break;
    cleaned = cleaned.slice(0, match.index).trim();
  }

  return cleaned;
}

function normalizeResourceList(values: string[]): string[] {
  let changed = false;
  const normalized: string[] = [];

  values.forEach((value) => {
    const cleaned = stripInlineSourceRefs(value);
    if (cleaned !== value) changed = true;
    if (cleaned) {
      normalized.push(cleaned);
    } else {
      changed = true;
    }
  });

  return changed ? normalized : values;
}

/**
 * Normalizes both protocol-level and step-level resource labels without
 * mutating the input or altering any structured source-reference fields.
 */
export function normalizeProtocolResourceLabels<
  T extends ProtocolResourceContainer,
>(protocol: T): T {
  const materials = normalizeResourceList(protocol.materials);
  const equipment = normalizeResourceList(protocol.equipment);
  let stepsChanged = false;
  const steps = protocol.steps.map((step) => {
    const stepMaterials = normalizeResourceList(step.materials);
    const stepEquipment = normalizeResourceList(step.equipment);
    if (
      stepMaterials === step.materials &&
      stepEquipment === step.equipment
    ) {
      return step;
    }
    stepsChanged = true;
    return {
      ...step,
      materials: stepMaterials,
      equipment: stepEquipment,
    };
  });

  if (
    materials === protocol.materials &&
    equipment === protocol.equipment &&
    !stepsChanged
  ) {
    return protocol;
  }

  return {
    ...protocol,
    materials,
    equipment,
    steps,
  } as T;
}
