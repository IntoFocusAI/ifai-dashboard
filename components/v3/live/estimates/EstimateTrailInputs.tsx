"use client";

import { figureTipAttrs } from "@/components/v3/live/FigureTip";
import {
  inputBenchmark,
  inputKindLabel,
  inputKindTip,
  inputValueText,
  NOT_AVAILABLE_LISTINGS_TIP,
  salesSourceRows,
} from "@/components/v3/live/estimates/trail-copy";
import { READ_NOT_AVAILABLE } from "@/lib/fender-canvas/canvas-reads";
import type { EstimateTrail, EstimateTrailInput } from "@/lib/estimates/types";

/** Where an input comes from, in a small tag whose tooltip says what that means and the exact column. */
function InputKindTag({ input }: { input: EstimateTrailInput }) {
  const label = inputKindLabel(input.kind);
  return (
    <span
      {...figureTipAttrs(label, inputKindTip(input), "estimate-input-kind")}
      className={`ifai-term estimate-kind estimate-kind-${input.kind}`}
      data-estimate-input-kind={input.kind}
    >
      {label}
    </span>
  );
}

function NotAvailable({ testId }: { testId: string }) {
  return <span {...figureTipAttrs(READ_NOT_AVAILABLE, NOT_AVAILABLE_LISTINGS_TIP, testId)}>{READ_NOT_AVAILABLE}</span>;
}

/** Each input with its value and where it comes from: kind, and the benchmark it cites. */
export function EstimateTrailInputs({ trail }: { trail: EstimateTrail }) {
  return (
    <table className="table-sm estimate-trail-inputs" data-estimate-inputs={trail.inputs.length}>
      <thead>
        <tr>
          <th scope="col">Input</th>
          <th scope="col" className="money">Value</th>
          <th scope="col">Where it comes from</th>
        </tr>
      </thead>
      <tbody>
        {trail.inputs.map((input) => {
          const benchmark = inputBenchmark(input, trail);
          const text = inputValueText(input, benchmark);
          return (
            <tr key={input.key} data-estimate-input={input.key}>
              <td>
                <span className="estimate-input-label">{input.label}</span>
              </td>
              <td className="money">{text === READ_NOT_AVAILABLE ? <NotAvailable testId="estimate-input-na" /> : text}</td>
              <td>
                <InputKindTag input={input} />
                {benchmark ? <span className="estimate-input-source">{benchmark.label}</span> : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Listings and annual sales by where each listing's sales figure comes from (approval 10). */
export function EstimateTrailSalesSplit({ trail }: { trail: EstimateTrail }) {
  const rows = salesSourceRows(trail);
  if (rows.length === 0) return null;
  return (
    <table className="table-sm estimate-trail-split" data-estimate-split={rows.length}>
      <thead>
        <tr>
          <th scope="col">Sales figure</th>
          <th scope="col" className="money">Listings</th>
          <th scope="col" className="money">Sales</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.source} data-estimate-split-source={row.source}>
            <td>{row.label}</td>
            <td className="money">{row.listings}</td>
            <td className="money">
              {row.annualSales === READ_NOT_AVAILABLE ? <NotAvailable testId="estimate-split-na" /> : row.annualSales}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
