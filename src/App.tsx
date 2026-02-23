import React, { useMemo, useState } from "react";
import {
  PATTERN_A,
  PATTERN_B,
  SimpleSTDPNetwork,
  type RunResult,
  type SpikePattern,
} from "./sim/SimpleSTDPNetwork";

function Sparkline({ values, min, max }: { values: number[]; min?: number; max?: number }) {
  const w = 520;
  const h = 120;
  const pad = 8;
  const vMin = min ?? Math.min(...values);
  const vMax = max ?? Math.max(...values);
  const denom = vMax - vMin || 1;

  const d = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
      const y = pad + (1 - (v - vMin) / denom) * (h - 2 * pad);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} className="rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
      <path d={d} fill="none" stroke="rgb(99 102 241)" strokeWidth={2} />
    </svg>
  );
}

function Raster({ result }: { result: RunResult }) {
  const w = 520;
  const h = 120;
  const pad = 10;
  const duration = result.t[result.t.length - 1] ?? 1;

  const spikesToLines = (spikes: boolean[], y: number, color: string) => {
    const lines: React.ReactElement[] = [];
    spikes.forEach((s, i) => {
      if (!s) return;
      const t = result.t[i];
      const x = pad + (t / duration) * (w - 2 * pad);
      lines.push(
        <line
          key={`${y}-${i}`}
          x1={x}
          y1={y - 10}
          x2={x}
          y2={y + 10}
          stroke={color}
          strokeWidth={2}
        />
      );
    });
    return lines;
  };

  return (
    <svg width={w} height={h} className="rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
      <text x={10} y={20} className="fill-slate-600" fontSize={12}>
        in1
      </text>
      <text x={10} y={55} className="fill-slate-600" fontSize={12}>
        in2
      </text>
      <text x={10} y={90} className="fill-slate-600" fontSize={12}>
        out
      </text>

      {spikesToLines(result.pre1, 22, "rgb(14 165 233)")}
      {spikesToLines(result.pre2, 57, "rgb(34 197 94)")}
      {spikesToLines(result.post, 92, "rgb(239 68 68)")}

      <line x1={pad} y1={35} x2={w - pad} y2={35} stroke="rgb(226 232 240)" />
      <line x1={pad} y1={70} x2={w - pad} y2={70} stroke="rgb(226 232 240)" />
    </svg>
  );
}

function hasSpike(spikes: boolean[]) {
  return spikes.some(Boolean);
}

export function App() {
  const [epochs, setEpochs] = useState(120);
  const [durationMs, setDurationMs] = useState(80);
  const [outThreshold, setOutThreshold] = useState(1.0);
  const [trained, setTrained] = useState(false);

  const { net, history } = useMemo(() => {
    const n = new SimpleSTDPNetwork({ outThreshold });
    const w1Hist: number[] = [];
    const w2Hist: number[] = [];

    // Train on A repeatedly
    for (let e = 0; e < epochs; e++) {
      n.train(PATTERN_A, durationMs);
      const { w1, w2 } = n.get_weights();
      w1Hist.push(w1);
      w2Hist.push(w2);
    }

    // Tests
    const testA = n.test(PATTERN_A, durationMs);
    const testB = n.test(PATTERN_B, durationMs);

    return {
      net: n,
      history: { w1Hist, w2Hist, testA, testB },
    };
  }, [epochs, durationMs, outThreshold, trained]);

  const weights = net.get_weights();
  const spikesA = hasSpike(history.testA.post);
  const spikesB = hasSpike(history.testB.post);

  const PatternCard = ({ title, pattern, result }: { title: string; pattern: SpikePattern; result: RunResult }) => (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-xs text-slate-500">
            {pattern.name}: in1 @ {pattern.pre1SpikeMs}ms, in2 @ {pattern.pre2SpikeMs}ms
          </div>
        </div>
        <div className="text-xs">
          <span
            className={
              "inline-flex items-center rounded-full px-2 py-1 font-medium ring-1 " +
              (hasSpike(result.post)
                ? "bg-red-50 text-red-700 ring-red-200"
                : "bg-slate-50 text-slate-700 ring-slate-200")
            }
          >
            out: {hasSpike(result.post) ? "SPIKE" : "no spike"}
          </span>
        </div>
      </div>
      <div className="mt-4">
        <Raster result={result} />
      </div>
      <div className="mt-4">
        <div className="text-xs text-slate-500">V(out)</div>
        <Sparkline values={result.vPost} min={0} max={1.2} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-zinc-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Simple STDP Network (2→1 LIF)</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Демо: два входных LIF нейрона, один выходной LIF нейрон и два STDP-синапса. Обучаем сеть на паттерне A
              (in1 раньше in2 на 10ms), затем проверяем A и B.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTrained((v) => !v)}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              Перезапустить обучение
            </button>
          </div>
        </header>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm font-semibold">Параметры</div>
            <div className="mt-4 space-y-3">
              <label className="block">
                <div className="text-xs text-slate-600">Epochs (обучающих эпизодов)</div>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={epochs}
                  min={1}
                  max={1000}
                  onChange={(e) => setEpochs(Number(e.target.value))}
                />
              </label>
              <label className="block">
                <div className="text-xs text-slate-600">Duration (ms)</div>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={durationMs}
                  min={20}
                  max={200}
                  onChange={(e) => setDurationMs(Number(e.target.value))}
                />
              </label>
              <label className="block">
                <div className="text-xs text-slate-600">Output threshold</div>
                <input
                  type="number"
                  step={0.05}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={outThreshold}
                  min={0.5}
                  max={1.5}
                  onChange={(e) => setOutThreshold(Number(e.target.value))}
                />
              </label>

              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="text-xs font-semibold text-slate-700">Итоговые веса</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
                    <div className="text-xs text-slate-500">w1 (in1→out)</div>
                    <div className="font-mono">{weights.w1.toFixed(3)}</div>
                  </div>
                  <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
                    <div className="text-xs text-slate-500">w2 (in2→out)</div>
                    <div className="font-mono">{weights.w2.toFixed(3)}</div>
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-600">
                Ожидание после обучения на A: вес от раннего входа (in1) усиливается, от позднего (in2) ослабевает.
                Тогда A вызывает спайк, а B — нет.
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
            <div className="flex items-baseline justify-between">
              <div className="text-sm font-semibold">Динамика весов во время обучения</div>
              <div className="text-xs text-slate-500">(после каждого эпизода)</div>
            </div>
            <div className="mt-3 grid gap-3">
              <div>
                <div className="text-xs text-slate-500">w1</div>
                <Sparkline values={history.w1Hist} min={0} max={2} />
              </div>
              <div>
                <div className="text-xs text-slate-500">w2</div>
                <Sparkline values={history.w2Hist} min={0} max={2} />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <PatternCard title="Тест после обучения: Pattern A" pattern={PATTERN_A} result={history.testA} />
          <PatternCard title="Тест после обучения: Pattern B" pattern={PATTERN_B} result={history.testB} />
        </section>

        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="text-sm font-semibold">Критерий успеха</div>
          <div className="mt-2 text-sm text-slate-700">
            <ul className="list-inside list-disc space-y-1">
              <li>
                На A: выход {spikesA ? "спайкает" : "не спайкает"}
              </li>
              <li>
                На B: выход {spikesB ? "спайкает" : "не спайкает"}
              </li>
            </ul>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Примечание: это минимальная учебная STDP-модель (delta-постсинаптический ток на спайках и парное STDP по
            времени последнего пре/пост спайка). Можно поиграть порогом выхода и числом эпох.
          </div>
        </section>
      </div>
    </div>
  );
}
