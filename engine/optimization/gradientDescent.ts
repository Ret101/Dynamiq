/**
 * Gradient descent optimizer with ADAM update rule.
 * Used for fine-tuning hardpoint positions after GA finds a good region.
 *
 * ADAM: Kingma & Ba (2015), "Adam: A Method for Stochastic Optimization."
 */

export interface AdamConfig {
  learningRate: number;
  beta1: number;    // first moment decay (default 0.9)
  beta2: number;    // second moment decay (default 0.999)
  epsilon: number;  // numerical stability (default 1e-8)
  maxIter: number;
  convergenceTol: number;
}

export interface GradientDescentResult {
  solution: number[];
  fitness: number;
  iterations: number;
  converged: boolean;
  history: Array<{ iteration: number; fitness: number; gradient_norm: number }>;
}

export function adamOptimize(
  initialGuess: number[],
  objectiveFunction: (x: number[]) => number,
  bounds: Array<{ min: number; max: number }>,
  config: Partial<AdamConfig> = {}
): GradientDescentResult {
  const {
    learningRate = 0.01,
    beta1 = 0.9,
    beta2 = 0.999,
    epsilon = 1e-8,
    maxIter = 500,
    convergenceTol = 1e-6,
  } = config;

  const n = initialGuess.length;
  let x = [...initialGuess];
  let m = new Array(n).fill(0); // first moment
  let v = new Array(n).fill(0); // second moment
  let t = 0;

  const history: GradientDescentResult['history'] = [];
  let prevFitness = objectiveFunction(x);

  for (let iter = 0; iter < maxIter; iter++) {
    t++;

    // Numerical gradient
    const grad = numericalGradient(objectiveFunction, x, 1e-4);

    // ADAM update
    m = m.map((mi, i) => beta1 * mi + (1 - beta1) * grad[i]);
    v = v.map((vi, i) => beta2 * vi + (1 - beta2) * grad[i] ** 2);

    const m_hat = m.map(mi => mi / (1 - beta1 ** t));
    const v_hat = v.map(vi => vi / (1 - beta2 ** t));

    x = x.map((xi, i) => {
      const step = learningRate * m_hat[i] / (Math.sqrt(v_hat[i]) + epsilon);
      const newX = xi - step;
      return Math.max(bounds[i].min, Math.min(bounds[i].max, newX));
    });

    const fitness = objectiveFunction(x);
    const gradNorm = Math.sqrt(grad.reduce((s, g) => s + g ** 2, 0));

    history.push({ iteration: iter, fitness, gradient_norm: gradNorm });

    if (Math.abs(fitness - prevFitness) < convergenceTol && gradNorm < convergenceTol) {
      return { solution: x, fitness, iterations: iter + 1, converged: true, history };
    }

    prevFitness = fitness;
  }

  return {
    solution: x,
    fitness: objectiveFunction(x),
    iterations: maxIter,
    converged: false,
    history,
  };
}

/** Numerical gradient using central differences. */
function numericalGradient(
  f: (x: number[]) => number,
  x: number[],
  h: number
): number[] {
  return x.map((xi, i) => {
    const xPlus  = [...x]; xPlus[i]  = xi + h;
    const xMinus = [...x]; xMinus[i] = xi - h;
    return (f(xPlus) - f(xMinus)) / (2 * h);
  });
}

/**
 * Nelder-Mead simplex method for derivative-free optimization.
 * Lagarias et al. (1998).
 */
export function nelderMead(
  initialGuess: number[],
  objectiveFunction: (x: number[]) => number,
  bounds: Array<{ min: number; max: number }>,
  maxIter = 1000,
  tol = 1e-7
): GradientDescentResult {
  const n = initialGuess.length;
  const alpha = 1.0; // reflection
  const gamma = 2.0; // expansion
  const rho   = 0.5; // contraction
  const sigma = 0.5; // shrinkage

  // Initialize simplex: n+1 points
  let simplex: number[][] = [initialGuess.map((x, i) => Math.max(bounds[i].min, Math.min(bounds[i].max, x)))];
  for (let i = 0; i < n; i++) {
    const point = [...simplex[0]];
    const step = Math.max(0.05 * Math.abs(point[i]), 0.00025);
    point[i] = Math.max(bounds[i].min, Math.min(bounds[i].max, point[i] + step));
    simplex.push(point);
  }

  let values = simplex.map(p => objectiveFunction(p));
  const history: GradientDescentResult['history'] = [];

  for (let iter = 0; iter < maxIter; iter++) {
    // Sort by value (ascending for minimization)
    const order = values.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0]);
    simplex = order.map(([, i]) => simplex[i]);
    values  = order.map(([v])   => v);

    history.push({ iteration: iter, fitness: -values[0], gradient_norm: values[n] - values[0] });

    // Convergence
    if (values[n] - values[0] < tol) break;

    // Centroid (exclude worst)
    const centroid = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) centroid[j] += simplex[i][j] / n;
    }

    // Reflection
    const xr = centroid.map((c, j) => Math.max(bounds[j].min, Math.min(bounds[j].max, c + alpha * (c - simplex[n][j]))));
    const fr = objectiveFunction(xr);

    if (fr < values[0]) {
      // Expansion
      const xe = centroid.map((c, j) => Math.max(bounds[j].min, Math.min(bounds[j].max, c + gamma * (xr[j] - c))));
      const fe = objectiveFunction(xe);
      if (fe < fr) { simplex[n] = xe; values[n] = fe; }
      else         { simplex[n] = xr; values[n] = fr; }
    } else if (fr < values[n - 1]) {
      simplex[n] = xr; values[n] = fr;
    } else {
      // Contraction
      const xc = centroid.map((c, j) => Math.max(bounds[j].min, Math.min(bounds[j].max, c + rho * (simplex[n][j] - c))));
      const fc = objectiveFunction(xc);
      if (fc < values[n]) { simplex[n] = xc; values[n] = fc; }
      else {
        // Shrinkage
        for (let i = 1; i <= n; i++) {
          simplex[i] = simplex[i].map((x, j) => Math.max(bounds[j].min, Math.min(bounds[j].max, simplex[0][j] + sigma * (x - simplex[0][j]))));
          values[i] = objectiveFunction(simplex[i]);
        }
      }
    }
  }

  return {
    solution: simplex[0],
    fitness: -values[0],
    iterations: history.length,
    converged: (values[n] - values[0]) < tol,
    history,
  };
}
