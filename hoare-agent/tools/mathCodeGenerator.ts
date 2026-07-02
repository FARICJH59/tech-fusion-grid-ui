/**
 * hoare-agent/tools/mathCodeGenerator.ts
 *
 * Tool: mathCodeGenerator
 * Accepts a mathematical description or equation, derives the required
 * computation steps, generates TypeScript or Python code implementing
 * the math, and validates the output format before returning.
 *
 * Integrates with the Eve agent as a "math_code_gen" task type.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Supported target languages for generated code. */
export type TargetLanguage = "typescript" | "python";

/**
 * A single step in the derived computation plan.
 */
export interface ComputationStep {
  /** 1-based step index. */
  index: number;
  /** Short label for this step (e.g. "Compute discriminant"). */
  label: string;
  /** Formal sub-expression or operation performed in this step. */
  expression: string;
}

/**
 * Input descriptor for the math code generator.
 */
export interface MathCodeRequest {
  /**
   * Free-form mathematical description or equation.
   * Examples:
   *   "Solve the quadratic equation ax² + bx + c = 0"
   *   "Compute AC power: P = V * I * cos(φ)"
   *   "Discrete Fourier Transform of a signal array"
   */
  description: string;
  /** Target output language. Defaults to "typescript". */
  language?: TargetLanguage;
  /**
   * Optional named variables relevant to the equation.
   * Providing these lets the generator produce more accurate code.
   * Example: { a: "number", b: "number", c: "number" }
   */
  variables?: Record<string, string>;
}

/**
 * Structured result returned by mathCodeGenerator.
 */
export interface MathCodeResult {
  /** Whether code generation succeeded. */
  status: "ok" | "error";
  /** Original description echoed for traceability. */
  description: string;
  /** Detected or inferred equation name / category. */
  equationName: string;
  /** Ordered list of computation steps derived from the description. */
  computationSteps: ComputationStep[];
  /** Target language of the generated code. */
  language: TargetLanguage;
  /** The generated source code implementing the math. */
  generatedCode: string;
  /** Validation notes on the generated output. */
  validationNotes: string[];
  /** Human-readable error message when status is "error". */
  error?: string;
}

// ---------------------------------------------------------------------------
// Internal: equation patterns and code templates
// ---------------------------------------------------------------------------

interface EquationPattern {
  pattern: RegExp;
  name: string;
  steps: Omit<ComputationStep, "index">[];
  tsCode: (vars: Record<string, string>) => string;
  pyCode: (vars: Record<string, string>) => string;
}

const EQUATION_PATTERNS: EquationPattern[] = [
  // ---- Quadratic formula ------------------------------------------------
  {
    pattern: /quadratic|ax[²2]\s*\+\s*bx|ax\^2/i,
    name: "Quadratic Equation (ax² + bx + c = 0)",
    steps: [
      { label: "Compute discriminant", expression: "Δ = b² - 4ac" },
      { label: "Check discriminant sign", expression: "if Δ < 0 → no real roots" },
      { label: "Compute roots", expression: "x = (-b ± √Δ) / (2a)" },
    ],
    tsCode: () => `/**
 * Solves the quadratic equation ax² + bx + c = 0.
 * Returns the real roots, or an empty array if none exist.
 */
export function solveQuadratic(
  a: number,
  b: number,
  c: number
): number[] {
  if (a === 0) {
    throw new Error("Coefficient 'a' must not be zero for a quadratic equation.");
  }
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return [];
  if (discriminant === 0) return [-b / (2 * a)];
  const sqrtD = Math.sqrt(discriminant);
  return [(-b + sqrtD) / (2 * a), (-b - sqrtD) / (2 * a)];
}`,
    pyCode: () => `import math

def solve_quadratic(a: float, b: float, c: float) -> list[float]:
    """Solves the quadratic equation ax² + bx + c = 0.

    Returns:
        A list of real roots (empty if none exist).

    Raises:
        ValueError: If 'a' is zero.
    """
    if a == 0:
        raise ValueError("Coefficient 'a' must not be zero for a quadratic equation.")
    discriminant = b ** 2 - 4 * a * c
    if discriminant < 0:
        return []
    if discriminant == 0:
        return [-b / (2 * a)]
    sqrt_d = math.sqrt(discriminant)
    return [(-b + sqrt_d) / (2 * a), (-b - sqrt_d) / (2 * a)]`,
  },

  // ---- AC power (P = V·I·cos φ) -----------------------------------------
  {
    pattern: /ac\s*power|P\s*=\s*V\s*[*×]\s*I|apparent\s*power|power\s*factor/i,
    name: "AC Power (P = V · I · cos φ)",
    steps: [
      { label: "Obtain RMS voltage and current", expression: "V_rms, I_rms" },
      { label: "Obtain power factor angle", expression: "φ (radians)" },
      { label: "Compute real power", expression: "P = V_rms × I_rms × cos(φ)" },
      { label: "Compute apparent power", expression: "S = V_rms × I_rms" },
      { label: "Compute reactive power", expression: "Q = V_rms × I_rms × sin(φ)" },
    ],
    tsCode: () => `/**
 * Computes AC real power, apparent power, and reactive power.
 *
 * @param voltageRms  - RMS voltage in volts (V).
 * @param currentRms  - RMS current in amperes (A).
 * @param phiRadians  - Power factor angle φ in radians.
 */
export function computeAcPower(
  voltageRms: number,
  currentRms: number,
  phiRadians: number
): { realPowerW: number; apparentPowerVA: number; reactivePowerVAR: number; powerFactor: number } {
  const apparentPowerVA = voltageRms * currentRms;
  const realPowerW = apparentPowerVA * Math.cos(phiRadians);
  const reactivePowerVAR = apparentPowerVA * Math.sin(phiRadians);
  const powerFactor = Math.cos(phiRadians);
  return { realPowerW, apparentPowerVA, reactivePowerVAR, powerFactor };
}`,
    pyCode: () => `import math

def compute_ac_power(
    voltage_rms: float,
    current_rms: float,
    phi_radians: float,
) -> dict[str, float]:
    """Computes AC real power, apparent power, and reactive power.

    Args:
        voltage_rms:  RMS voltage in volts (V).
        current_rms:  RMS current in amperes (A).
        phi_radians:  Power factor angle φ in radians.

    Returns:
        Dictionary with real_power_w, apparent_power_va,
        reactive_power_var, and power_factor.
    """
    apparent_power_va = voltage_rms * current_rms
    real_power_w = apparent_power_va * math.cos(phi_radians)
    reactive_power_var = apparent_power_va * math.sin(phi_radians)
    power_factor = math.cos(phi_radians)
    return {
        "real_power_w": real_power_w,
        "apparent_power_va": apparent_power_va,
        "reactive_power_var": reactive_power_var,
        "power_factor": power_factor,
    }`,
  },

  // ---- Discrete Fourier Transform ----------------------------------------
  {
    pattern: /DFT|discrete\s*fourier|FFT|frequency\s*domain/i,
    name: "Discrete Fourier Transform (DFT)",
    steps: [
      { label: "Accept time-domain signal array", expression: "x[n], n = 0 … N-1" },
      { label: "Initialise output array", expression: "X[k] = 0 for k = 0 … N-1" },
      {
        label: "Compute each frequency bin",
        expression: "X[k] = Σ_{n=0}^{N-1} x[n] · e^{-j2πkn/N}",
      },
      { label: "Return complex spectrum", expression: "{ magnitude, phase } per bin" },
    ],
    tsCode: () => `/**
 * Computes the Discrete Fourier Transform (DFT) of a real signal.
 * O(N²) — use an FFT library for large N.
 *
 * @param signal - Array of real-valued time-domain samples.
 * @returns      Array of { re, im, magnitude, phaseRad } for each frequency bin.
 */
export function dft(
  signal: number[]
): Array<{ re: number; im: number; magnitude: number; phaseRad: number }> {
  const N = signal.length;
  return Array.from({ length: N }, (_, k) => {
    let re = 0;
    let im = 0;
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      re += signal[n] * Math.cos(angle);
      im -= signal[n] * Math.sin(angle);
    }
    return {
      re,
      im,
      magnitude: Math.sqrt(re * re + im * im),
      phaseRad: Math.atan2(im, re),
    };
  });
}`,
    pyCode: () => `import math

def dft(signal: list[float]) -> list[dict[str, float]]:
    """Computes the Discrete Fourier Transform (DFT) of a real signal.

    O(N²) — use numpy.fft for large N.

    Args:
        signal: List of real-valued time-domain samples.

    Returns:
        List of dicts with keys re, im, magnitude, phase_rad per bin.
    """
    n_samples = len(signal)
    result = []
    for k in range(n_samples):
        re = 0.0
        im = 0.0
        for n, x_n in enumerate(signal):
            angle = 2 * math.pi * k * n / n_samples
            re += x_n * math.cos(angle)
            im -= x_n * math.sin(angle)
        result.append({
            "re": re,
            "im": im,
            "magnitude": math.sqrt(re ** 2 + im ** 2),
            "phase_rad": math.atan2(im, re),
        })
    return result`,
  },

  // ---- Ohm's Law ---------------------------------------------------------
  {
    pattern: /ohm|V\s*=\s*I\s*[*×]\s*R|resistance/i,
    name: "Ohm's Law (V = IR)",
    steps: [
      { label: "Identify known quantities", expression: "two of {V, I, R}" },
      { label: "Derive unknown via Ohm's Law", expression: "V = I·R  /  I = V/R  /  R = V/I" },
      { label: "Compute power dissipation", expression: "P = V·I = I²·R = V²/R" },
    ],
    tsCode: () => `/**
 * Applies Ohm's Law to derive the missing electrical quantity.
 * Provide exactly two of the three parameters; set the third to null.
 *
 * @returns { voltage, current, resistance, powerW }
 */
export function ohmsLaw(params: {
  voltage: number | null;
  current: number | null;
  resistance: number | null;
}): { voltage: number; current: number; resistance: number; powerW: number } {
  let { voltage, current, resistance } = params;

  if (voltage === null && current !== null && resistance !== null) {
    voltage = current * resistance;
  } else if (current === null && voltage !== null && resistance !== null) {
    if (resistance === 0) throw new Error("Resistance must not be zero.");
    current = voltage / resistance;
  } else if (resistance === null && voltage !== null && current !== null) {
    if (current === 0) throw new Error("Current must not be zero.");
    resistance = voltage / current;
  } else {
    throw new Error("Provide exactly two of: voltage, current, resistance.");
  }

  const powerW = (voltage as number) * (current as number);
  return {
    voltage: voltage as number,
    current: current as number,
    resistance: resistance as number,
    powerW,
  };
}`,
    pyCode: () => `def ohms_law(
    voltage: float | None,
    current: float | None,
    resistance: float | None,
) -> dict[str, float]:
    """Applies Ohm's Law to derive the missing electrical quantity.

    Provide exactly two of the three parameters; pass None for the unknown.

    Returns:
        Dictionary with voltage, current, resistance, and power_w.

    Raises:
        ValueError: On invalid input or division by zero.
    """
    if voltage is None and current is not None and resistance is not None:
        voltage = current * resistance
    elif current is None and voltage is not None and resistance is not None:
        if resistance == 0:
            raise ValueError("Resistance must not be zero.")
        current = voltage / resistance
    elif resistance is None and voltage is not None and current is not None:
        if current == 0:
            raise ValueError("Current must not be zero.")
        resistance = voltage / current
    else:
        raise ValueError("Provide exactly two of: voltage, current, resistance.")

    power_w = voltage * current  # type: ignore[operator]
    return {
        "voltage": voltage,
        "current": current,
        "resistance": resistance,
        "power_w": power_w,
    }`,
  },
];

// ---------------------------------------------------------------------------
// Internal: step-derivation fallback
// ---------------------------------------------------------------------------

function deriveGenericSteps(description: string): Omit<ComputationStep, "index">[] {
  // Heuristically extract variable-like tokens (single uppercase or greek letters)
  const varTokens = [...new Set(description.match(/\b[A-Zα-ωΑ-Ω]\b/g) ?? [])];
  const steps: Omit<ComputationStep, "index">[] = [
    {
      label: "Parse input description",
      expression: `description: "${description.slice(0, 60)}${description.length > 60 ? "…" : ""}"`,
    },
  ];
  if (varTokens.length > 0) {
    steps.push({
      label: "Identify variables",
      expression: `variables: ${varTokens.join(", ")}`,
    });
  }
  steps.push(
    { label: "Validate input constraints", expression: "assert all inputs are finite numbers" },
    { label: "Execute computation", expression: "apply mathematical definition" },
    { label: "Return structured result", expression: "{ status, result }" }
  );
  return steps;
}

function buildGenericTsCode(description: string, variables: Record<string, string>): string {
  const paramList = Object.entries(variables)
    .map(([name, type]) => `${name}: ${type}`)
    .join(",\n  ");

  const paramListInline = Object.keys(variables).join(", ");
  const hasParams = paramList.length > 0;

  return `/**
 * Generated implementation for:
 * "${description}"
 *
 * TODO: Replace the placeholder body with the actual computation.
 */
export function computeMath(${hasParams ? `\n  ${paramList}\n` : ""}): unknown {
  // Validate inputs
${
  hasParams
    ? Object.keys(variables)
        .map((v) => `  if (${v} === undefined || ${v} === null) throw new Error("'${v}' is required.");`)
        .join("\n") + "\n"
    : ""
}
  // TODO: Implement computation for: ${description}
  throw new Error(\`computeMath(${hasParams ? paramListInline : ""}) is not yet implemented.\`);
}`;
}

function buildGenericPyCode(description: string, variables: Record<string, string>): string {
  const paramList = Object.entries(variables)
    .map(([name, type]) => `${name}: ${type}`)
    .join(", ");

  return `def compute_math(${paramList}) -> object:
    """Generated implementation for:
    "${description}"

    TODO: Replace the placeholder body with the actual computation.
    """
    # Validate inputs
${Object.keys(variables)
  .map((v) => `    if ${v} is None:\n        raise ValueError("'${v}' is required.")`)
  .join("\n")}
    # TODO: Implement computation for: ${description}
    raise NotImplementedError(f"compute_math(${Object.keys(variables).join(", ")}) is not yet implemented.")`;
}

// ---------------------------------------------------------------------------
// Internal: output validation
// ---------------------------------------------------------------------------

function validateOutput(result: Omit<MathCodeResult, "validationNotes">): string[] {
  const notes: string[] = [];

  if (!result.generatedCode || result.generatedCode.trim().length === 0) {
    notes.push("ERROR: generatedCode is empty.");
  } else {
    notes.push("generatedCode: non-empty ✓");
  }

  if (result.computationSteps.length === 0) {
    notes.push("WARNING: no computation steps were derived.");
  } else {
    notes.push(`computationSteps: ${result.computationSteps.length} step(s) ✓`);
    const indices = result.computationSteps.map((s) => s.index);
    const isSequential = indices.every((v, i) => v === i + 1);
    if (!isSequential) {
      notes.push("WARNING: computationSteps indices are not sequential.");
    }
  }

  if (result.language === "typescript") {
    const hasExport = /export\s+(function|class|const)/.test(result.generatedCode);
    if (!hasExport) notes.push("WARNING: TypeScript output lacks an exported symbol.");
    else notes.push("TypeScript export: present ✓");

    const hasJsDoc = /\/\*\*/.test(result.generatedCode);
    if (!hasJsDoc) notes.push("INFO: TypeScript output has no JSDoc comment.");
    else notes.push("JSDoc comment: present ✓");
  }

  if (result.language === "python") {
    const hasDef = /^def\s+\w+/.test(result.generatedCode);
    if (!hasDef) notes.push("WARNING: Python output lacks a top-level function definition.");
    else notes.push("Python function: present ✓");

    const hasDocstring = /"""/.test(result.generatedCode);
    if (!hasDocstring) notes.push("INFO: Python output has no docstring.");
    else notes.push("Python docstring: present ✓");
  }

  return notes;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates TypeScript or Python code that implements a mathematical
 * description or equation.
 *
 * Steps performed:
 *  1. Match the description against known equation patterns.
 *  2. Derive ordered computation steps.
 *  3. Emit well-typed, documented source code in the target language.
 *  4. Validate the output structure and surface any issues as notes.
 *
 * @param request - The math code generation request.
 * @returns       A structured result containing code, steps, and validation.
 */
export function mathCodeGenerator(request: MathCodeRequest): MathCodeResult {
  const language: TargetLanguage = request.language ?? "typescript";
  const variables: Record<string, string> = request.variables ?? {};

  try {
    // 1. Match against known equation patterns
    const match = EQUATION_PATTERNS.find((p) => p.pattern.test(request.description));

    const rawSteps = match
      ? match.steps
      : deriveGenericSteps(request.description);

    // 2. Assign sequential indices to steps
    const computationSteps: ComputationStep[] = rawSteps.map((s, i) => ({
      index: i + 1,
      ...s,
    }));

    // 3. Generate code
    let generatedCode: string;
    if (match) {
      generatedCode =
        language === "typescript"
          ? match.tsCode(variables)
          : match.pyCode(variables);
    } else {
      generatedCode =
        language === "typescript"
          ? buildGenericTsCode(request.description, variables)
          : buildGenericPyCode(request.description, variables);
    }

    const equationName = match?.name ?? "Custom Mathematical Expression";

    // 4. Validate output
    const partial = {
      status: "ok" as const,
      description: request.description,
      equationName,
      computationSteps,
      language,
      generatedCode,
    };
    const validationNotes = validateOutput(partial);
    const hasError = validationNotes.some((n) => n.startsWith("ERROR"));

    return {
      ...partial,
      status: hasError ? "error" : "ok",
      validationNotes,
    };
  } catch (err) {
    return {
      status: "error",
      description: request.description,
      equationName: "Unknown",
      computationSteps: [],
      language,
      generatedCode: "",
      validationNotes: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
