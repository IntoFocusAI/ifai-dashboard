/* eslint-disable */
// @ts-nocheck
"use client";

import { Fragment } from "react";
import Image from "next/image";
import { css } from "@/lib/intofocus-portal/css";
import { HoverButton } from "@/components/intofocus-portal/HoverButton";
import type { PortalVals } from "@/lib/intofocus-portal/types";

type Props = { v: PortalVals };

export function PortalView({ v }: Props) {
  const {
    title,
    subtitle,
    stamp,
    crumbVis,
    isHub,
    todayBg,
    todayColor,
    mapBg,
    mapColor,
    setToday,
    setMap,
    m,
    isData,
    hubSimple,
    mapSimple,
    sugSimple,
    readSimple,
    aeoSimple,
    ecomSimple,
    simpleBg,
    simpleColor,
    dataBg,
    dataColor,
    setSimple,
    setData,
    nav,
    goHub,
    goSug,
    goRead,
    goAeo,
    goEcom,
    openHelp,
    closeHelp,
    help,
    topFour,
    tiles,
    rows,
    rowCount,
    respRows,
    resp,
    respLabel,
    toggleResp,
    areaChips,
    statusChips,
    sortChips,
    drawer,
    drawerOpen,
    positions,
    prompts,
    sources,
    products,
    findings,
    dataset,
    dataGrid,
    dataCols,
    dataRows,
    dataCount,
  } = v;

  return (
    <div style={css("display:flex;width:1440px;min-height:1024px;background:#fafafb;color:#16161a;font-size:14px;line-height:1.45")}>
    
      <div style={css("width:236px;flex:0 0 236px;background:#ffffff;border-right:1px solid #e8e8ec;display:flex;flex-direction:column;height:1024px;position:sticky;top:0")}>
        <div style={css("padding:22px 20px 16px 20px;display:flex;flex-direction:column;gap:16px")}>
          <div style={css("width:100%")}>
            <Image
              src="/logo-primary-horizontal.png"
              alt="IntoFocus AI"
              width={300}
              height={91}
              priority
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>
          <div style={css("border:1px solid #e8e8ec;border-radius:7px;padding:8px 10px;display:flex;flex-direction:column;gap:1px;background:#fafafb")}>
            <div style={css("font-size:10px;letter-spacing:0.07em;text-transform:uppercase;color:#8e8e99;font-weight:600")}>Client</div>
            <div style={css("font-size:13px;font-weight:600")}>Fender Guitars</div>
          </div>
        </div>
        <div style={css("padding:0 10px;display:flex;flex-direction:column;gap:1px")}>
          {nav.map((n, _i) => (
    <Fragment key={_i}>
    
            <HoverButton onClick={n.go} style={{ all: "unset", cursor: n.cursor, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "7px 10px", borderRadius: "6px", fontSize: "13px", fontWeight: n.weight, color: n.color, background: n.bg }} hoverStyle="background:#f6f6f8">
              <span>{n.label}</span>
              {n.locked && (
    
                <span style={css("font-size:10px;color:#b3b3bd")}>Not in plan</span>
              
    )}
            </HoverButton>
          
    </Fragment>
    ))}
        </div>
        <div style={css("margin-top:auto;padding:16px 20px 20px 20px;display:flex;flex-direction:column;gap:12px")}>
          <HoverButton onClick={openHelp} style={css("all:unset;cursor:pointer;font-size:12px;color:#5c5c66;display:flex;align-items:center;gap:7px")} hoverStyle="color:#16161a">
            <span style={css("width:15px;height:15px;border-radius:50%;border:1px solid #c9c9d2;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#8e8e99")}>?</span>
            Help & walkthrough
          </HoverButton>
          <div style={css("border-top:1px solid #f0f0f3;padding-top:12px;display:flex;flex-direction:column;gap:5px")}>
            <div style={css("font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:0.04em;color:#b3372c;background:#fdeceb;border-radius:4px;padding:4px 6px")}>PLACEHOLDER DATA</div>
            <div style={css("font-size:11px;color:#a8a8b2")}>Nothing here is live.</div>
          </div>
        </div>
      </div>
    
      <div style={css("flex:1;min-width:0;position:relative")}>
        <div style={css("padding:28px 44px 80px 44px;max-width:1204px")}>
    
          <HoverButton onClick={goHub} style={{ all: "unset", cursor: "pointer", fontSize: "12px", color: "#8e8e99", display: "inline-block", marginBottom: "12px", visibility: crumbVis }} hoverStyle="color:#16161a">← Home &nbsp;/&nbsp; <span style={css("color:#5c5c66")}>{title}</span></HoverButton>
    
          <div style={css("display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:24px")}>
            <div style={css("display:flex;flex-direction:column;gap:6px")}>
              <div style={css("font-size:12px;color:#8e8e99;font-variant-numeric:tabular-nums")}>{stamp}</div>
              <div style={css("font-size:25px;font-weight:600;letter-spacing:-0.02em")}>{title}</div>
              <div style={css("font-size:13.5px;color:#5c5c66;max-width:640px;text-wrap:pretty")}>{subtitle}</div>
            </div>
            <div style={css("display:flex;align-items:center;gap:10px;flex:0 0 auto")}>
              {isHub && (
    
                <div style={css("display:flex;border:1px solid #e8e8ec;border-radius:7px;overflow:hidden;background:#ffffff;margin-right:6px")}>
                  <HoverButton onClick={setToday} style={{ all: "unset", cursor: "pointer", padding: "6px 13px", fontSize: "12px", fontWeight: "600", color: todayColor, background: todayBg }}>Today</HoverButton>
                  <HoverButton onClick={setMap} style={{ all: "unset", cursor: "pointer", padding: "6px 13px", fontSize: "12px", fontWeight: "600", color: mapColor, background: mapBg }}>Map</HoverButton>
                </div>
              
    )}
              <div style={css("font-size:11px;color:#a8a8b2;text-align:right;max-width:110px;line-height:1.3")}>Same data,<br />two audiences</div>
              <div style={css("display:flex;border:1px solid #e8e8ec;border-radius:7px;overflow:hidden;background:#ffffff")}>
                <HoverButton onClick={setSimple} style={{ all: "unset", cursor: "pointer", padding: "6px 13px", fontSize: "12px", fontWeight: "600", color: simpleColor, background: simpleBg }}>Simple</HoverButton>
                <HoverButton onClick={setData} style={{ all: "unset", cursor: "pointer", padding: "6px 13px", fontSize: "12px", fontWeight: "600", color: dataColor, background: dataBg }}>Data</HoverButton>
              </div>
            </div>
          </div>
    
          
          {isData && (
    
            <div style={css("display:flex;flex-direction:column;gap:14px;animation:fadeIn 0.16s ease")}>
              <div style={css("display:flex;align-items:center;gap:10px")}>
                <div style={css("font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#5c5c66;border:1px solid #e8e8ec;border-radius:5px;padding:4px 8px;background:#ffffff")}>{dataset}</div>
                <HoverButton style={css("all:unset;cursor:pointer;font-size:11px;font-weight:600;color:#4b45c6;border:1px solid #dcdbf6;background:#f4f3fd;border-radius:5px;padding:4px 9px")}>Export CSV</HoverButton>
                <HoverButton style={css("all:unset;cursor:pointer;font-size:11px;color:#5c5c66;border:1px solid #e8e8ec;background:#ffffff;border-radius:5px;padding:4px 9px")}>Add filter</HoverButton>
                <div style={css("margin-left:auto;font-size:11px;color:#a8a8b2;font-variant-numeric:tabular-nums")}>{dataCount}</div>
              </div>
              <div style={css("background:#ffffff;border:1px solid #e8e8ec;border-radius:8px;overflow:hidden")}>
                <div style={{ display: "grid", gridTemplateColumns: dataGrid, padding: "8px 14px", background: "#fafafb", borderBottom: "1px solid #e8e8ec", fontSize: "10.5px", letterSpacing: "0.06em", textTransform: "uppercase", color: "#8e8e99", fontWeight: "600" }}>
                  {dataCols.map((c, _i) => (
    <Fragment key={_i}>
    
                    <div style={{ textAlign: c.align }}>{c.label}</div>
                  
    </Fragment>
    ))}
                </div>
                {dataRows.map((r, _i) => (
    <Fragment key={_i}>
    
                  <div style={{ display: "grid", gridTemplateColumns: dataGrid, padding: "7px 14px", borderBottom: "1px solid #f4f4f6", fontSize: "12.5px", alignItems: "center" }}>
                    {r.cells.map((c, _i) => (
    <Fragment key={_i}>
    
                      <div style={{ textAlign: c.align, color: c.color, fontWeight: c.weight, fontFamily: c.font, fontVariantNumeric: "tabular-nums", paddingRight: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.v}</div>
                    
    </Fragment>
    ))}
                  </div>
                
    </Fragment>
    ))}
              </div>
              <div style={css("font-size:11.5px;color:#a8a8b2")}>Sortable columns, inline filters and export are the operator path, the same rows the simple view renders as opinion.</div>
            </div>
          
    )}
    
          
          {hubSimple && (
    
            <div style={css("display:flex;flex-direction:column;gap:28px")}>
              <div style={css("background:#ffffff;border:1px solid #e8e8ec;border-radius:10px;overflow:hidden")}>
                <div style={css("padding:16px 20px;border-bottom:1px solid #f0f0f3;display:flex;align-items:center;justify-content:space-between")}>
                  <div style={css("display:flex;flex-direction:column;gap:2px")}>
                    <div style={css("font-size:14px;font-weight:600")}>Do these first</div>
                    <div style={css("font-size:12px;color:#8e8e99")}>Ranked by estimated visibility recovered per hour of effort.</div>
                  </div>
                  <HoverButton onClick={goSug} style={css("all:unset;cursor:pointer;font-size:12px;font-weight:600;color:#4b45c6")}>All 8 suggestions →</HoverButton>
                </div>
                {topFour.map((s, _i) => (
    <Fragment key={_i}>
    
                  <HoverButton onClick={s.open} style={css("all:unset;box-sizing:border-box;cursor:pointer;display:block;width:100%;border-bottom:1px solid #f4f4f6;padding:15px 20px")} hoverStyle="background:#fcfcfd">
                    <div style={css("display:flex;align-items:flex-start;gap:16px")}>
                      <div style={css("font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#a8a8b2;width:14px;padding-top:2px;font-variant-numeric:tabular-nums")}>{s.rank}</div>
                      <div style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:5px")}>
                        <div style={css("font-size:14px;font-weight:600;letter-spacing:-0.01em;text-wrap:pretty")}>{s.title}</div>
                        <div style={css("font-size:12.5px;color:#5c5c66;text-wrap:pretty;max-width:660px")}>{s.whyShort}</div>
                      </div>
                      <div style={css("display:flex;align-items:flex-start;gap:22px;flex:0 0 auto")}>
                        <div style={css("display:flex;flex-direction:column;gap:2px;width:112px")}>
                          <div style={css("font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:#a8a8b2;font-weight:600")}>Impact</div>
                          <div style={{ fontSize: "12.5px", fontWeight: "600", color: s.impactColor, fontVariantNumeric: "tabular-nums" }}>{s.impactNote}</div>
                        </div>
                        <div style={css("display:flex;flex-direction:column;gap:2px;width:96px")}>
                          <div style={css("font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:#a8a8b2;font-weight:600")}>Effort</div>
                          <div style={css("font-size:12.5px;color:#5c5c66;font-variant-numeric:tabular-nums")}>{s.effort}</div>
                        </div>
                        <div style={css("font-size:12px;color:#a8a8b2;padding-top:12px")}>→</div>
                      </div>
                    </div>
                  </HoverButton>
                
    </Fragment>
    ))}
              </div>
    
              <div style={css("display:grid;grid-template-columns:1.35fr 1fr;gap:20px")}>
                <div style={css("background:#ffffff;border:1px solid #e8e8ec;border-radius:10px;padding:20px 22px;display:flex;flex-direction:column;gap:14px")}>
                  <div style={css("display:flex;align-items:flex-start;justify-content:space-between")}>
                    <div style={css("display:flex;flex-direction:column;gap:3px")}>
                      <div style={css("font-size:13px;font-weight:600")}>AI Visibility Score</div>
                      <div style={css("font-size:11.5px;color:#8e8e99")}>Share of 100 tracked prompts where you appear</div>
                    </div>
                    <HoverButton onClick={goAeo} style={css("all:unset;cursor:pointer;font-size:12px;font-weight:600;color:#4b45c6")}>AEO →</HoverButton>
                  </div>
                  <div style={css("display:flex;align-items:flex-end;gap:18px")}>
                    <div style={css("font-size:54px;font-weight:600;letter-spacing:-0.035em;line-height:0.95;font-variant-numeric:tabular-nums")}>34</div>
                    <div style={css("display:flex;flex-direction:column;gap:2px;padding-bottom:6px")}>
                      <div style={css("font-size:13px;font-weight:600;color:#b3372c;font-variant-numeric:tabular-nums")}>−13 pts / 30 days</div>
                      <div style={css("font-size:11.5px;color:#8e8e99")}>Was 47 on 3 Aug</div>
                    </div>
                    <svg viewBox="0 0 220 56" style={css("width:200px;height:52px;margin-left:auto")}>
                      <polyline points="2,12 10,14 18,10 26,15 34,13 42,19 50,17 58,22 66,20 74,26 82,24 90,31 98,29 106,34 114,32 122,37 130,35 138,40 146,38 154,42 162,40 170,44 178,42 186,46 194,44 202,47 210,45 218,49" fill="none" stroke="#b3372c" strokeWidth="1.6" strokeLinejoin="round"></polyline>
                      <circle cx="218" cy="49" r="3" fill="#b3372c" />
                    </svg>
                  </div>
                  <div style={css("border-top:1px solid #f0f0f3;padding-top:12px;display:flex;gap:10px;align-items:stretch")}>
                    <div style={css("width:3px;background:#b3372c;border-radius:2px;flex:0 0 3px")}></div>
                    <div style={css("font-size:12px;color:#5c5c66;text-wrap:pretty")}>9 of the 13 lost points trace to two e-commerce events: the Trailhead Mini buy-box loss (11 Aug) and the Roadster 20 rank slide (19 Aug). <HoverButton onClick={goAeo} style={css("all:unset;cursor:pointer;color:#4b45c6;font-weight:600")}>See the paired timeline</HoverButton></div>
                  </div>
                </div>
    
                <div style={css("background:#ffffff;border:1px solid #e8e8ec;border-radius:10px;padding:20px 22px;display:flex;flex-direction:column;gap:13px")}>
                  <div style={css("display:flex;align-items:flex-start;justify-content:space-between")}>
                    <div style={css("display:flex;flex-direction:column;gap:3px")}>
                      <div style={css("font-size:13px;font-weight:600")}>Readiness Score</div>
                      <div style={css("font-size:11.5px;color:#8e8e99")}>Objective checks: pass or fail</div>
                    </div>
                    <HoverButton onClick={goRead} style={css("all:unset;cursor:pointer;font-size:12px;font-weight:600;color:#4b45c6")}>Checklist →</HoverButton>
                  </div>
                  <div style={css("display:flex;align-items:flex-end;gap:6px")}>
                    <div style={css("font-size:54px;font-weight:600;letter-spacing:-0.035em;line-height:0.95;font-variant-numeric:tabular-nums")}>11</div>
                    <div style={css("font-size:22px;color:#a8a8b2;font-weight:500;padding-bottom:6px;font-variant-numeric:tabular-nums")}>/ 18</div>
                    <div style={css("font-size:12px;color:#5c5c66;padding-bottom:9px;margin-left:8px")}>checks passing</div>
                  </div>
                  <div style={css("display:flex;gap:3px")}>
                    <div style={css("height:6px;flex:11;background:#10744a;border-radius:3px")}></div>
                    <div style={css("height:6px;flex:7;background:#ececed;border-radius:3px")}></div>
                  </div>
                  <div style={css("border-top:1px solid #f0f0f3;padding-top:12px;display:flex;flex-direction:column;gap:7px")}>
                    <div style={css("display:flex;justify-content:space-between;font-size:12px")}><span style={css("color:#5c5c66")}>Amazon strategy</span><span style={css("font-weight:600;color:#b3372c;font-variant-numeric:tabular-nums")}>1 / 4</span></div>
                    <div style={css("display:flex;justify-content:space-between;font-size:12px")}><span style={css("color:#5c5c66")}>Category & taxonomy</span><span style={css("font-weight:600;color:#8a5a00;font-variant-numeric:tabular-nums")}>2 / 3</span></div>
                    <div style={css("display:flex;justify-content:space-between;font-size:12px")}><span style={css("color:#5c5c66")}>Brand keyword defense</span><span style={css("font-weight:600;color:#b3372c;font-variant-numeric:tabular-nums")}>0 / 2</span></div>
                  </div>
                </div>
              </div>
    
              <div style={css("display:flex;flex-direction:column;gap:12px")}>
                <div style={css("font-size:11px;letter-spacing:0.07em;text-transform:uppercase;color:#8e8e99;font-weight:600")}>Your modules</div>
                <div style={css("display:grid;grid-template-columns:repeat(3,1fr);gap:16px")}>
                  {tiles.map((t, _i) => (
    <Fragment key={_i}>
    
                    <HoverButton onClick={t.go} style={{ all: "unset", cursor: t.cursor, background: t.bg, border: "1px solid #e8e8ec", borderRadius: "10px", padding: "17px 18px 15px 18px", display: "flex", flexDirection: "column", gap: "9px", height: "136px" }} hoverStyle="border-color:#c9c9d2">
                      <div style={css("display:flex;align-items:center;justify-content:space-between;width:100%")}>
                        <div style={{ fontSize: "13.5px", fontWeight: "600", color: t.titleColor }}>{t.title}</div>
                        <div style={css("font-size:10.5px;color:#b3b3bd")}>{t.badge}</div>
                      </div>
                      <div style={{ fontSize: "12px", color: t.bodyColor, textWrap: "pretty", textAlign: "left" }}>{t.body}</div>
                      <div style={{ marginTop: "auto", fontSize: "12.5px", fontWeight: "600", color: t.metricColor, fontVariantNumeric: "tabular-nums" }}>{t.metric}</div>
                    </HoverButton>
                  
    </Fragment>
    ))}
                </div>
              </div>
            </div>
          
    )}
    
          
          {mapSimple && (
    
            <div style={css("display:flex;flex-direction:column;gap:14px")}>
              <div style={css("display:flex;align-items:center;gap:10px")}>
                <div style={css("font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#8e8e99;font-weight:600")}>Module map</div>
                <div style={css("margin-left:auto;display:flex;align-items:center;gap:8px")}>
                  <HoverButton onClick={m.toggleStack} style={css("all:unset;cursor:pointer;font-size:12px;color:#5c5c66;border:1px solid #e8e8ec;background:#ffffff;border-radius:6px;padding:5px 10px")} hoverStyle="border-color:#c9c9d2">{m.stackLabel}</HoverButton>
                  <HoverButton onClick={m.toggleTheme} style={css("all:unset;cursor:pointer;font-size:12px;color:#5c5c66;border:1px solid #e8e8ec;background:#ffffff;border-radius:6px;padding:5px 10px")} hoverStyle="border-color:#c9c9d2">{m.themeLabel} theme</HoverButton>
                </div>
              </div>
    
              <div style={{ border: `1px solid ${m.t.border}`, borderRadius: "12px", background: m.t.bg, overflow: "hidden" }}>
                {m.stacked && (
    
                  <div style={{ padding: "24px", display: "flex", justifyContent: "center", background: m.t.bg }}>
                    <div style={css("width:390px;display:flex;flex-direction:column;gap:16px")}>
                      <div style={{ border: `1.5px solid ${m.t.border}`, borderRadius: "10px", background: m.t.node, padding: "16px 18px", display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ fontSize: "14px", fontWeight: "600", color: m.t.ink }}>Fender Guitars</div>
                        <div style={css("display:flex;gap:24px")}>
                          <div style={css("display:flex;flex-direction:column;gap:1px")}>
                            <span style={{ fontSize: "10.5px", letterSpacing: "0.06em", textTransform: "uppercase", color: m.t.ink3, fontWeight: "600" }}>Readiness</span>
                            <span style={{ fontSize: "20px", fontWeight: "600", color: m.t.ink, fontVariantNumeric: "tabular-nums" }}>11 / 18</span>
                          </div>
                          <div style={css("display:flex;flex-direction:column;gap:1px")}>
                            <span style={{ fontSize: "10.5px", letterSpacing: "0.06em", textTransform: "uppercase", color: m.t.ink3, fontWeight: "600" }}>Visibility</span>
                            <span style={{ fontSize: "20px", fontWeight: "600", color: m.t.ink, fontVariantNumeric: "tabular-nums" }}>34 <span style={{ fontSize: "12px", color: m.t.bad }}>↓ 13</span></span>
                          </div>
                        </div>
                        <div style={{ fontSize: "12px", color: m.t.bad, borderTop: `1px solid ${m.t.border}`, paddingTop: "10px" }}>3 e-com issues suppressing AI visibility</div>
                      </div>
                      {m.groups.map((g, _i) => (
    <Fragment key={_i}>
    
                        <div style={css("display:flex;flex-direction:column;gap:8px")}>
                          <HoverButton onClick={g.go} style={css("all:unset;cursor:pointer;display:flex;align-items:baseline;justify-content:space-between;gap:12px")}>
                            <span style={{ fontSize: "13px", fontWeight: "600", color: m.t.ink }}>{g.name}</span>
                            <span style={{ fontSize: "12px", fontWeight: "600", color: g.tone, fontVariantNumeric: "tabular-nums" }}>{g.stat}</span>
                          </HoverButton>
                          <div style={{ display: "flex", flexDirection: "column", gap: "1px", paddingLeft: "12px", borderLeft: `1px solid ${m.t.line}` }}>
                            {g.items.map((i, _i) => (
    <Fragment key={_i}>
    
                              <HoverButton onClick={i.go} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", padding: "7px 0", borderBottom: `1px solid ${m.t.border}` }}>
                                <span style={{ fontSize: "12.5px", color: m.t.ink2 }}>{i.label}</span>
                                <span style={{ fontSize: "12px", color: m.t.ink3, fontVariantNumeric: "tabular-nums" }}>{i.stat}</span>
                              </HoverButton>
                            
    </Fragment>
    ))}
                          </div>
                        </div>
                      
    </Fragment>
    ))}
                      <div style={{ fontSize: "11.5px", color: m.t.ink3, textWrap: "pretty" }}>Below 1024px the diagram becomes a nested list with the same nodes, the same state, and no shrinking.</div>
                    </div>
                  </div>
                
    )}
    
                {m.diagram && (
    
                  <div style={{ position: "relative", width: "1112px", height: "760px", background: m.t.bg }}>
                    <svg viewBox="0 0 1112 760" style={css("position:absolute;left:0;top:0;width:1112px;height:760px")}>
                      <line x1="556" y1="380" x2="331" y2="200" stroke={m.t.line} strokeWidth="1.5" />
                      <line x1="556" y1="380" x2="781" y2="200" stroke={m.t.line} strokeWidth="1.5" />
                      <line x1="556" y1="380" x2="556" y2="650" stroke={m.t.line} strokeWidth="1.5" />
                      <line x1="556" y1="380" x2="250" y2="640" stroke={m.t.border} strokeWidth="1" />
                      <line x1="556" y1="380" x2="862" y2="640" stroke={m.t.border} strokeWidth="1" />
                      <line x1="331" y1="200" x2="172" y2="105" stroke={m.t.line} strokeWidth="1" />
                      <line x1="331" y1="200" x2="97" y2="250" stroke={m.t.line} strokeWidth="1" />
                      <line x1="781" y1="200" x2="940" y2="105" stroke={m.t.line} strokeWidth="1" />
                      <line x1="781" y1="200" x2="1015" y2="250" stroke={m.t.line} strokeWidth="1" />
                      <line x1="781" y1="200" x2="960" y2="395" stroke={m.t.line} strokeWidth="1" />
                      <line x1="781" y1="200" x2="830" y2="470" stroke={m.t.line} strokeWidth="1" />
                      <line x1="417" y1="200" x2="695" y2="200" stroke={m.t.bad} strokeWidth="1.5" />
                      <circle cx="417" cy="200" r="2.5" fill={m.t.bad} />
                      <circle cx="695" cy="200" r="2.5" fill={m.t.bad} />
                    </svg>
    
                    <div style={css("position:absolute;left:406px;top:184px;width:300px;display:flex;justify-content:center")}>
                      <div style={{ background: m.t.bg, padding: "3px 10px", fontSize: "11.5px", fontWeight: "600", color: m.t.bad, textAlign: "center", textWrap: "pretty", lineHeight: "1.3" }}>3 e-com issues suppressing<br />AI visibility</div>
                    </div>
    
                    <div style={{ position: "absolute", left: "426px", top: "250px", width: "260px", height: "260px", boxSizing: "border-box", border: `1.5px solid ${m.t.border}`, borderRadius: "50%", background: m.t.node, padding: "0 34px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
                      <div style={css("display:flex;flex-direction:column;align-items:center;gap:1px")}>
                        <div style={{ fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: m.t.ink3, fontWeight: "600" }}>Client</div>
                        <div style={{ fontSize: "17px", fontWeight: "600", letterSpacing: "-0.015em", color: m.t.ink }}>Fender Guitars</div>
                      </div>
                      <div style={{ width: "64px", height: "1px", background: m.t.border }}></div>
                      <div style={css("display:flex;align-items:flex-start;gap:22px")}>
                        <HoverButton onClick={goRead} style={css("all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:1px;width:82px")}>
                          <span style={{ fontSize: "9.5px", letterSpacing: "0.06em", textTransform: "uppercase", color: m.t.ink3, fontWeight: "600" }}>Readiness</span>
                          <span style={{ fontSize: "23px", fontWeight: "600", letterSpacing: "-0.03em", color: m.t.ink, fontVariantNumeric: "tabular-nums", lineHeight: "1.15" }}>11/18</span>
                          <span style={{ fontSize: "10.5px", color: m.t.ink2, textAlign: "center" }}>7 failing</span>
                        </HoverButton>
                        <div style={{ width: "1px", height: "44px", background: m.t.border }}></div>
                        <HoverButton onClick={goAeo} style={css("all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:1px;width:82px")}>
                          <span style={{ fontSize: "9.5px", letterSpacing: "0.06em", textTransform: "uppercase", color: m.t.ink3, fontWeight: "600" }}>Visibility</span>
                          <span style={{ fontSize: "23px", fontWeight: "600", letterSpacing: "-0.03em", color: m.t.ink, fontVariantNumeric: "tabular-nums", lineHeight: "1.15" }}>34</span>
                          <span style={{ fontSize: "10.5px", fontWeight: "600", color: m.t.bad, fontVariantNumeric: "tabular-nums", textAlign: "center" }}>↓ 13 / 30d</span>
                        </HoverButton>
                      </div>
                    </div>
    
                    {m.nodes.map((n, _i) => (
    <Fragment key={_i}>
    
                      <HoverButton onClick={n.go} style={{ all: "unset", boxSizing: "border-box", cursor: n.cursor, position: "absolute", left: n.left, top: n.top, width: n.size, height: n.size, border: `${n.borderW} solid ${n.border}`, borderRadius: "50%", background: n.bg, padding: n.pad, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px", textAlign: "center" }} hoverStyle="border-color:{{ m.t.ink3 }}">
                        <span style={{ fontSize: n.titleSize, fontWeight: "600", letterSpacing: "-0.01em", color: n.color, lineHeight: "1.25" }}>{n.title}</span>
                        <span style={{ fontSize: n.statSize, fontWeight: "600", letterSpacing: "-0.025em", color: n.statColor, fontVariantNumeric: "tabular-nums", lineHeight: "1.2" }}>{n.stat}</span>
                        <span style={{ fontSize: n.metaSize, color: n.metaColor, lineHeight: "1.3", textWrap: "pretty" }}>{n.meta}</span>
                        {n.urgent && (
    
                          <span style={{ position: "absolute", top: n.dotOffset, right: n.dotOffset, width: "7px", height: "7px", borderRadius: "50%", background: n.urgentColor }}></span>
                        
    )}
                        {n.locked && (
    
                          <span style={css("display:flex;flex-direction:column;align-items:center;gap:4px")}>
                            <span style={{ width: "9px", height: "7px", border: `1px solid ${m.t.lockInk}`, borderRadius: "2px", display: "inline-block", borderTopWidth: "3px", borderTopLeftRadius: "5px", borderTopRightRadius: "5px" }}></span>
                            <span style={{ fontSize: "9.5px", letterSpacing: "0.05em", textTransform: "uppercase", color: m.t.lockInk, fontWeight: "600" }}>{n.lockLabel}</span>
                          </span>
                        
    )}
                      </HoverButton>
                    
    </Fragment>
    ))}
                  </div>
                
    )}
              </div>
              <div style={css("font-size:11.5px;color:#8e8e99;text-wrap:pretty;max-width:760px")}>Every node opens its spoke screen, and every spoke returns here. The line between AEO and E-commerce is the product's argument: the two are one system, and the e-commerce side is currently holding the other down.</div>
            </div>
          
    )}
    
          
          {sugSimple && (
    
            <div style={css("display:flex;flex-direction:column;gap:16px")}>
              <div style={css("display:flex;align-items:center;gap:14px;flex-wrap:wrap")}>
                <div style={css("display:flex;align-items:center;gap:6px")}>
                  {areaChips.map((c, _i) => (
    <Fragment key={_i}>
    
                    <HoverButton onClick={c.go} style={{ all: "unset", cursor: "pointer", fontSize: "12px", fontWeight: "600", padding: "5px 11px", borderRadius: "20px", color: c.color, background: c.bg, border: `1px solid ${c.border}` }}>{c.label}</HoverButton>
                  
    </Fragment>
    ))}
                </div>
                <div style={css("width:1px;height:20px;background:#e8e8ec")}></div>
                <div style={css("display:flex;align-items:center;gap:6px")}>
                  {statusChips.map((c, _i) => (
    <Fragment key={_i}>
    
                    <HoverButton onClick={c.go} style={{ all: "unset", cursor: "pointer", fontSize: "12px", padding: "5px 11px", borderRadius: "20px", color: c.color, background: c.bg, border: `1px solid ${c.border}` }}>{c.label}</HoverButton>
                  
    </Fragment>
    ))}
                </div>
                <div style={css("margin-left:auto;display:flex;align-items:center;gap:7px")}>
                  <span style={css("font-size:12px;color:#8e8e99")}>Sort</span>
                  {sortChips.map((c, _i) => (
    <Fragment key={_i}>
    
                    <HoverButton onClick={c.go} style={{ all: "unset", cursor: "pointer", fontSize: "12px", fontWeight: "600", padding: "5px 10px", borderRadius: "6px", color: c.color, background: c.bg }}>{c.label}</HoverButton>
                  
    </Fragment>
    ))}
                  <HoverButton onClick={toggleResp} style={css("all:unset;cursor:pointer;font-size:12px;color:#5c5c66;border:1px solid #e8e8ec;background:#ffffff;border-radius:6px;padding:5px 10px;margin-left:6px")}>{respLabel}</HoverButton>
                </div>
              </div>
    
              <div style={css("background:#ffffff;border:1px solid #e8e8ec;border-radius:10px;overflow:hidden")}>
                <div style={css("display:grid;grid-template-columns:42px 1fr 148px 116px 126px;padding:9px 20px;background:#fafafb;border-bottom:1px solid #e8e8ec;font-size:10.5px;letter-spacing:0.06em;text-transform:uppercase;color:#8e8e99;font-weight:600")}>
                  <div>#</div><div>Action & why it was suggested</div><div>Est. impact</div><div>Effort</div><div>Status</div>
                </div>
                {rows.map((s, _i) => (
    <Fragment key={_i}>
    
                  <div style={{ display: "grid", gridTemplateColumns: "42px 1fr 148px 116px 126px", padding: "15px 20px", borderBottom: "1px solid #f4f4f6", alignItems: "flex-start", background: s.rowBg }}>
                    <HoverButton onClick={s.open} style={css("all:unset;cursor:pointer;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#a8a8b2;padding-top:3px;font-variant-numeric:tabular-nums")}>{s.rank}</HoverButton>
                    <HoverButton onClick={s.open} style={css("all:unset;cursor:pointer;display:flex;flex-direction:column;gap:7px;padding-right:24px")}>
                      <div style={css("font-size:14px;font-weight:600;letter-spacing:-0.01em;text-wrap:pretty")}>{s.title}</div>
                      <div style={css("font-size:12.5px;color:#5c5c66;text-wrap:pretty")}>{s.whyShort}</div>
                      <div style={css("display:flex;gap:6px;flex-wrap:wrap")}>
                        {s.chips.map((ch, _i) => (
    <Fragment key={_i}>
    
                          <span style={{ fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: "10.5px", padding: "3px 7px", borderRadius: "4px", background: ch.bg, color: ch.color }}>{ch.text}</span>
                        
    </Fragment>
    ))}
                      </div>
                    </HoverButton>
                    <div style={css("display:flex;flex-direction:column;gap:2px;padding-top:2px")}>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: s.impactColor }}>{s.impact}</div>
                      <div style={css("font-size:11.5px;color:#8e8e99;font-variant-numeric:tabular-nums")}>{s.impactNote}</div>
                    </div>
                    <div style={css("font-size:12.5px;color:#5c5c66;padding-top:3px;font-variant-numeric:tabular-nums")}>{s.effort}</div>
                    <div style={css("display:flex;flex-direction:column;gap:6px;align-items:flex-start")}>
                      <HoverButton onClick={s.cycle} style={{ all: "unset", cursor: "pointer", fontSize: "11.5px", fontWeight: "600", padding: "4px 9px", borderRadius: "20px", color: s.statusColor, background: s.statusBg, border: `1px solid ${s.statusBorder}` }}>{s.status}</HoverButton>
                      <HoverButton onClick={s.open} style={css("all:unset;cursor:pointer;font-size:11.5px;color:#4b45c6;font-weight:600")}>Open →</HoverButton>
                    </div>
                  </div>
                
    </Fragment>
    ))}
                <div style={css("padding:11px 20px;font-size:12px;color:#8e8e99;background:#fcfcfd")}>{rowCount}</div>
              </div>
    
              {resp && (
    
                <div style={css("display:flex;gap:26px;align-items:flex-start;padding-top:12px;animation:fadeIn 0.18s ease")}>
                  <div style={css("width:376px;flex:0 0 376px;background:#ffffff;border:1px solid #e8e8ec;border-radius:24px;padding:9px")}>
                    <div style={css("border:1px solid #f0f0f3;border-radius:17px;overflow:hidden")}>
                      <div style={css("padding:13px 15px 11px 15px;border-bottom:1px solid #f0f0f3;display:flex;flex-direction:column;gap:8px")}>
                        <div style={css("display:flex;align-items:center;justify-content:space-between")}>
                          <span style={css("font-size:12px;color:#8e8e99")}>← Home</span>
                          <span style={css("font-size:11px;font-weight:600;color:#5c5c66;border:1px solid #e8e8ec;border-radius:14px;padding:3px 8px")}>Simple</span>
                        </div>
                        <div style={css("font-size:17px;font-weight:600;letter-spacing:-0.015em")}>Suggestions</div>
                        <div style={css("display:flex;gap:6px")}>
                          <span style={css("font-size:11.5px;font-weight:600;padding:4px 9px;border-radius:20px;background:#16161a;color:#ffffff")}>All 8</span>
                          <span style={css("font-size:11.5px;padding:4px 9px;border-radius:20px;border:1px solid #e8e8ec;color:#5c5c66")}>AEO</span>
                          <span style={css("font-size:11.5px;padding:4px 9px;border-radius:20px;border:1px solid #e8e8ec;color:#5c5c66")}>E-com</span>
                        </div>
                      </div>
                      {respRows.map((s, _i) => (
    <Fragment key={_i}>
    
                        <div style={css("padding:13px 15px;border-bottom:1px solid #f4f4f6;display:flex;flex-direction:column;gap:7px")}>
                          <div style={css("display:flex;gap:9px;align-items:baseline")}>
                            <span style={css("font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#a8a8b2")}>{s.rank}</span>
                            <span style={css("font-size:13.5px;font-weight:600;letter-spacing:-0.01em;text-wrap:pretty")}>{s.title}</span>
                          </div>
                          <div style={css("font-size:12px;color:#5c5c66;text-wrap:pretty;padding-left:20px")}>{s.whyMobile}</div>
                          <div style={css("display:flex;align-items:center;gap:8px;padding-left:20px;flex-wrap:wrap")}>
                            <span style={{ fontSize: "11px", fontWeight: "600", color: s.impactColor }}>{s.impactNote}</span>
                            <span style={css("width:3px;height:3px;border-radius:50%;background:#c9c9d2")}></span>
                            <span style={css("font-size:11px;color:#8e8e99")}>{s.effort}</span>
                            <span style={{ marginLeft: "auto", fontSize: "11px", fontWeight: "600", padding: "3px 8px", borderRadius: "20px", color: s.statusColor, background: s.statusBg }}>{s.status}</span>
                          </div>
                        </div>
                      
    </Fragment>
    ))}
                      <div style={css("padding:11px 15px;font-size:11.5px;color:#a8a8b2")}>Impact and effort collapse under the action; status moves to the row end. Filters scroll horizontally.</div>
                    </div>
                  </div>
                  <div style={css("max-width:320px;display:flex;flex-direction:column;gap:10px;padding-top:8px")}>
                    <div style={css("font-size:13px;font-weight:600")}>Responsive treatment · 390px</div>
                    <div style={css("font-size:12.5px;color:#5c5c66;text-wrap:pretty")}>One column, rank stays as the anchor, the three metadata columns become a single meta line. The opinionated default order is what survives the squeeze. Sorting drops to a sheet.</div>
                  </div>
                </div>
              
    )}
            </div>
          
    )}
    
          
          {readSimple && (
    
            <div style={css("display:flex;flex-direction:column;gap:22px")}>
              <div style={css("background:#ffffff;border:1px solid #e8e8ec;border-radius:10px;padding:20px 22px;display:flex;align-items:center;gap:34px")}>
                <div style={css("display:flex;align-items:flex-end;gap:6px")}>
                  <div style={css("font-size:44px;font-weight:600;letter-spacing:-0.035em;line-height:0.95;font-variant-numeric:tabular-nums")}>11</div>
                  <div style={css("font-size:19px;color:#a8a8b2;font-weight:500;padding-bottom:4px;font-variant-numeric:tabular-nums")}>/ 18</div>
                </div>
                <div style={css("display:flex;flex-direction:column;gap:6px;flex:1")}>
                  <div style={css("display:flex;gap:4px")}>
                    <div style={css("height:8px;flex:11;background:#10744a;border-radius:2px")}></div>
                    <div style={css("height:8px;flex:7;background:#ececed;border-radius:2px")}></div>
                  </div>
                  <div style={css("font-size:12px;color:#8e8e99")}>11 checks pass, 7 fail. Each line below is measured, not estimated. The value and the threshold it was compared against are both shown.</div>
                </div>
                <div style={css("border-left:1px solid #f0f0f3;padding-left:24px;display:flex;flex-direction:column;gap:3px;max-width:230px")}>
                  <div style={css("font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#a8a8b2;font-weight:600")}>Not a forecast</div>
                  <div style={css("font-size:12px;color:#5c5c66;text-wrap:pretty")}>Unlike the AI Visibility Score, nothing here is sampled or modelled. Re-run it and you get the same answer.</div>
                </div>
              </div>
    
              {positions.map((p, _i) => (
    <Fragment key={_i}>
    
                <div style={css("background:#ffffff;border:1px solid #e8e8ec;border-radius:10px;overflow:hidden")}>
                  <div style={css("padding:12px 20px;border-bottom:1px solid #f0f0f3;display:flex;align-items:center;justify-content:space-between;background:#fcfcfd")}>
                    <div style={css("font-size:13px;font-weight:600")}>{p.name}</div>
                    <div style={{ fontSize: "12.5px", fontWeight: "600", color: p.scoreColor, fontVariantNumeric: "tabular-nums" }}>{p.score}</div>
                  </div>
                  {p.checks.map((c, _i) => (
    <Fragment key={_i}>
    
                    <div style={css("border-bottom:1px solid #f4f4f6")}>
                      <div style={css("display:grid;grid-template-columns:26px 1fr 132px 132px 150px;padding:12px 20px;align-items:center;gap:8px")}>
                        <div style={{ width: "18px", height: "18px", borderRadius: "4px", background: c.markBg, color: c.markColor, fontSize: "11px", fontWeight: "600", display: "flex", alignItems: "center", justifyContent: "center" }}>{c.mark}</div>
                        <div style={css("font-size:13px;text-wrap:pretty")}>{c.label}</div>
                        <div style={{ fontSize: "12.5px", fontWeight: "600", textAlign: "right", fontVariantNumeric: "tabular-nums", color: c.markColor }}>{c.value}</div>
                        <div style={css("font-size:11.5px;color:#a8a8b2;text-align:right;font-variant-numeric:tabular-nums")}>{c.threshold}</div>
                        <div style={css("display:flex;justify-content:flex-end")}>
                          <HoverButton onClick={c.toggle} style={css("all:unset;cursor:pointer;font-size:11.5px;font-weight:600;color:#4b45c6")}>{c.caret}</HoverButton>
                        </div>
                      </div>
                      {c.open && (
    
                        <div style={css("padding:0 20px 16px 46px;display:flex;flex-direction:column;gap:10px;animation:fadeIn 0.15s ease")}>
                          <div style={css("background:#fafafb;border:1px solid #f0f0f3;border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:8px")}>
                            <div style={css("font-size:12.5px;color:#16161a;text-wrap:pretty")}>{c.why}</div>
                            <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
                              <span style={css("font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;color:#8e8e99;background:#ffffff;border:1px solid #e8e8ec;border-radius:4px;padding:3px 7px")}>{c.source}</span>
                              <span style={css("font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;color:#8e8e99")}>measured value {c.value} · {c.threshold}</span>
                            </div>
                          </div>
                          {c.trace && (
    
                            <HoverButton onClick={c.traceGo} style={css("all:unset;cursor:pointer;font-size:12px;color:#4b45c6;font-weight:600;display:flex;align-items:center;gap:7px")}>
                              <span style={css("font-size:11px;color:#a8a8b2;font-weight:400")}>Traces up to</span> {c.traceLabel} →
                            </HoverButton>
                          
    )}
                        </div>
                      
    )}
                    </div>
                  
    </Fragment>
    ))}
                </div>
              
    </Fragment>
    ))}
            </div>
          
    )}
    
          
          {aeoSimple && (
    
            <div style={css("display:flex;flex-direction:column;gap:22px")}>
              <div style={css("background:#ffffff;border:1px solid #e8e8ec;border-radius:10px;padding:22px 24px;display:flex;flex-direction:column;gap:18px")}>
                <div style={css("display:flex;align-items:flex-start;justify-content:space-between;gap:24px")}>
                  <div style={css("display:flex;align-items:flex-end;gap:20px")}>
                    <div style={css("display:flex;flex-direction:column;gap:2px")}>
                      <div style={css("font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#a8a8b2;font-weight:600")}>Visibility</div>
                      <div style={css("display:flex;align-items:flex-end;gap:10px")}>
                        <div style={css("font-size:44px;font-weight:600;letter-spacing:-0.035em;line-height:0.95;font-variant-numeric:tabular-nums")}>34</div>
                        <div style={css("font-size:13px;font-weight:600;color:#b3372c;padding-bottom:5px;font-variant-numeric:tabular-nums")}>−13 / 30d</div>
                      </div>
                    </div>
                  </div>
                  <div style={css("display:flex;align-items:center;gap:18px;font-size:11.5px;color:#5c5c66")}>
                    <div style={css("display:flex;align-items:center;gap:6px")}><span style={css("width:14px;height:2px;background:#4b45c6;display:inline-block")}></span> Visibility score</div>
                    <div style={css("display:flex;align-items:center;gap:6px")}><span style={css("width:14px;border-top:1px dashed #b3372c;display:inline-block")}></span> E-commerce event</div>
                  </div>
                </div>
    
                <svg viewBox="0 0 1040 260" style={css("width:100%;height:260px")}>
                  <rect x="0" y="0" width="1040" height="260" fill="#ffffff" />
                  <line x1="40" y1="30" x2="1030" y2="30" stroke="#f4f4f6" strokeWidth="1" />
                  <line x1="40" y1="90" x2="1030" y2="90" stroke="#f4f4f6" strokeWidth="1" />
                  <line x1="40" y1="150" x2="1030" y2="150" stroke="#f4f4f6" strokeWidth="1" />
                  <line x1="40" y1="210" x2="1030" y2="210" stroke="#e8e8ec" strokeWidth="1" />
                  <text x="8" y="34" fontSize="10" fill="#a8a8b2" fontFamily="ui-monospace,Menlo,monospace">60</text>
                  <text x="8" y="94" fontSize="10" fill="#a8a8b2" fontFamily="ui-monospace,Menlo,monospace">45</text>
                  <text x="8" y="154" fontSize="10" fill="#a8a8b2" fontFamily="ui-monospace,Menlo,monospace">30</text>
                  <text x="8" y="214" fontSize="10" fill="#a8a8b2" fontFamily="ui-monospace,Menlo,monospace">15</text>
                  <line x1="452" y1="24" x2="452" y2="210" stroke="#b3372c" strokeWidth="1" strokeDasharray="3 3" />
                  <circle cx="452" cy="24" r="3" fill="#b3372c" />
                  <text x="460" y="22" fontSize="11" fill="#b3372c" fontFamily="-apple-system,Helvetica,sans-serif" fontWeight="600">11 Aug · Trailhead Mini loses buy box</text>
                  <line x1="700" y1="48" x2="700" y2="210" stroke="#b3372c" strokeWidth="1" strokeDasharray="3 3" />
                  <circle cx="700" cy="48" r="3" fill="#b3372c" />
                  <text x="708" y="46" fontSize="11" fill="#b3372c" fontFamily="-apple-system,Helvetica,sans-serif" fontWeight="600">19 Aug · Roadster 20 rank 16 → 41</text>
                  <polyline points="40,84 74,79 108,88 142,82 176,95 210,90 244,101 278,97 312,92 346,105 380,112 414,108 452,110 486,138 520,134 554,142 588,137 622,148 656,144 700,146 734,168 768,162 802,171 836,167 870,176 904,172 938,180 972,176 1006,182" fill="none" stroke="#4b45c6" strokeWidth="2" strokeLinejoin="round"></polyline>
                  <circle cx="1006" cy="182" r="3.5" fill="#4b45c6" />
                  <text x="40" y="232" fontSize="10" fill="#a8a8b2" fontFamily="ui-monospace,Menlo,monospace">3 Aug</text>
                  <text x="440" y="232" fontSize="10" fill="#a8a8b2" fontFamily="ui-monospace,Menlo,monospace">14 Aug</text>
                  <text x="690" y="232" fontSize="10" fill="#a8a8b2" fontFamily="ui-monospace,Menlo,monospace">22 Aug</text>
                  <text x="975" y="232" fontSize="10" fill="#a8a8b2" fontFamily="ui-monospace,Menlo,monospace">2 Sep</text>
                </svg>
    
                <div style={css("border-top:1px solid #f0f0f3;padding-top:14px;display:flex;gap:10px;align-items:stretch")}>
                  <div style={css("width:3px;background:#b3372c;border-radius:2px;flex:0 0 3px")}></div>
                  <div style={css("display:flex;flex-direction:column;gap:4px")}>
                    <div style={css("font-size:12.5px;color:#16161a;text-wrap:pretty;max-width:760px")}>Both step-downs follow an e-commerce event by 7 to 9 days, the interval it takes the sources assistants cite to refresh. The visibility line is a lagging indicator of what happens on the listing.</div>
                    <HoverButton onClick={goEcom} style={css("all:unset;cursor:pointer;font-size:12px;color:#4b45c6;font-weight:600")}>See both events in E-commerce →</HoverButton>
                  </div>
                </div>
              </div>
    
              <div style={css("display:grid;grid-template-columns:1.55fr 1fr;gap:20px;align-items:start")}>
                <div style={css("background:#ffffff;border:1px solid #e8e8ec;border-radius:10px;overflow:hidden")}>
                  <div style={css("padding:14px 18px;border-bottom:1px solid #f0f0f3;display:flex;flex-direction:column;gap:2px")}>
                    <div style={css("font-size:13px;font-weight:600")}>Tracked prompts</div>
                    <div style={css("font-size:11.5px;color:#8e8e99")}>Each prompt is run 20× per assistant across 5 assistants. Open a row to see the runs behind it.</div>
                  </div>
                  {prompts.map((p, _i) => (
    <Fragment key={_i}>
    
                    <div style={css("border-bottom:1px solid #f4f4f6")}>
                      <div style={css("display:grid;grid-template-columns:1fr 104px 74px 58px 24px;padding:11px 18px;align-items:center;gap:10px")}>
                        <div style={css("display:flex;flex-direction:column;gap:5px;min-width:0")}>
                          <div style={css("font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>“{p.q}”</div>
                          <div style={css("height:4px;background:#f4f4f6;border-radius:2px;overflow:hidden;width:100%")}>
                            <div style={{ height: "4px", width: p.pct, background: p.barColor, borderRadius: "2px" }}></div>
                          </div>
                        </div>
                        <div style={css("font-size:12.5px;font-weight:600;text-align:right;font-variant-numeric:tabular-nums")}>{p.rate}</div>
                        <div style={css("font-size:11.5px;color:#8e8e99;text-align:right;font-variant-numeric:tabular-nums")}>{p.pct} appear</div>
                        <div style={{ fontSize: "12px", fontWeight: "600", textAlign: "right", color: p.deltaColor, fontVariantNumeric: "tabular-nums" }}>{p.delta}</div>
                        <HoverButton onClick={p.toggle} style={css("all:unset;cursor:pointer;font-size:14px;color:#a8a8b2;text-align:right;font-weight:600")}>{p.caret}</HoverButton>
                      </div>
                      {p.open && (
    
                        <div style={css("padding:0 18px 14px 18px;animation:fadeIn 0.15s ease")}>
                          <div style={css("background:#fafafb;border:1px solid #f0f0f3;border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:10px")}>
                            <div style={css("font-size:12px;color:#5c5c66")}>{p.runs}</div>
                            <div style={css("display:grid;grid-template-columns:repeat(2,1fr);gap:8px 20px")}>
                              {p.detail.map((d, _i) => (
    <Fragment key={_i}>
    
                                <div style={css("display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #f0f0f3;padding-bottom:5px")}>
                                  <span style={css("font-size:11.5px;color:#8e8e99")}>{d.k}</span>
                                  <span style={css("font-size:11.5px;font-weight:600;font-variant-numeric:tabular-nums")}>{d.v}</span>
                                </div>
                              
    </Fragment>
    ))}
                            </div>
                            <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-top:1px solid #f0f0f3;padding-top:10px")}>
                              <span style={css("font-size:11px;color:#a8a8b2")}>Supports the conclusion</span>
                              <span style={css("font-size:12px;font-weight:600")}>“{p.conclusion}”</span>
                              <HoverButton onClick={p.traceGo} style={css("all:unset;cursor:pointer;font-size:12px;color:#4b45c6;font-weight:600;margin-left:auto")}>{p.traceLabel} →</HoverButton>
                            </div>
                          </div>
                        </div>
                      
    )}
                    </div>
                  
    </Fragment>
    ))}
                </div>
    
                <div style={css("display:flex;flex-direction:column;gap:20px")}>
                  <div style={css("background:#ffffff;border:1px solid #e8e8ec;border-radius:10px;padding:18px")}>
                    <div style={css("display:flex;flex-direction:column;gap:3px;margin-bottom:14px")}>
                      <div style={css("font-size:13px;font-weight:600")}>Where the answers came from</div>
                      <div style={css("font-size:11.5px;color:#8e8e99")}>Citation share, 30 days</div>
                    </div>
                    <div style={css("display:flex;flex-direction:column;gap:12px")}>
                      {sources.map((s, _i) => (
    <Fragment key={_i}>
    
                        <div style={css("display:flex;flex-direction:column;gap:5px")}>
                          <div style={css("display:flex;align-items:baseline;justify-content:space-between")}>
                            <span style={css("font-size:12.5px")}>{s.name}</span>
                            <span style={css("font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums")}>{s.weight}</span>
                          </div>
                          <div style={css("height:6px;background:#f4f4f6;border-radius:3px;overflow:hidden")}>
                            <div style={{ height: "6px", width: s.bar, background: s.color, borderRadius: "3px" }}></div>
                          </div>
                          <div style={css("font-size:11px;color:#a8a8b2;font-variant-numeric:tabular-nums")}>{s.cites} naming you</div>
                        </div>
                      
    </Fragment>
    ))}
                    </div>
                    <div style={css("border-top:1px solid #f0f0f3;margin-top:16px;padding-top:12px;font-size:11.5px;color:#5c5c66;text-wrap:pretty")}>Source weighting is industry-specific. In musical instruments, community threads outweigh editorial round-ups; in home appliances the order reverses. These weights are modelled for your category, not global.</div>
                  </div>
                  <div style={css("background:#f4f3fd;border:1px solid #dcdbf6;border-radius:10px;padding:16px 18px;display:flex;flex-direction:column;gap:7px")}>
                    <div style={css("font-size:12.5px;font-weight:600;color:#4b45c6")}>Every finding here names its e-commerce cause</div>
                    <div style={css("font-size:12px;color:#5c5c66;text-wrap:pretty")}>Open any prompt row and the last line traces up to the suggestion it produced. The same pattern works in reverse from the E-commerce findings.</div>
                  </div>
                </div>
              </div>
            </div>
          
    )}
    
          
          {ecomSimple && (
    
            <div style={css("display:flex;flex-direction:column;gap:22px")}>
              <div style={css("display:grid;grid-template-columns:repeat(4,1fr);gap:16px")}>
                <div style={css("background:#ffffff;border:1px solid #e8e8ec;border-radius:10px;padding:16px 18px;display:flex;flex-direction:column;gap:5px")}>
                  <div style={css("font-size:11.5px;color:#8e8e99")}>Buy-box coverage</div>
                  <div style={css("font-size:30px;font-weight:600;letter-spacing:-0.03em;font-variant-numeric:tabular-nums")}>62%</div>
                  <div style={css("font-size:11.5px;font-weight:600;color:#b3372c;font-variant-numeric:tabular-nums")}>−31 pp / 30d</div>
                </div>
                <div style={css("background:#ffffff;border:1px solid #e8e8ec;border-radius:10px;padding:16px 18px;display:flex;flex-direction:column;gap:5px")}>
                  <div style={css("font-size:11.5px;color:#8e8e99")}>Median rank, tracked</div>
                  <div style={css("font-size:30px;font-weight:600;letter-spacing:-0.03em;font-variant-numeric:tabular-nums")}>38</div>
                  <div style={css("font-size:11.5px;font-weight:600;color:#b3372c;font-variant-numeric:tabular-nums")}>↓ 22 places</div>
                </div>
                <div style={css("background:#ffffff;border:1px solid #e8e8ec;border-radius:10px;padding:16px 18px;display:flex;flex-direction:column;gap:5px")}>
                  <div style={css("font-size:11.5px;color:#8e8e99")}>Unauthorised sellers</div>
                  <div style={css("font-size:30px;font-weight:600;letter-spacing:-0.03em;font-variant-numeric:tabular-nums")}>14</div>
                  <div style={css("font-size:11.5px;font-weight:600;color:#b3372c;font-variant-numeric:tabular-nums")}>+9 / 30d</div>
                </div>
                <div style={css("background:#ffffff;border:1px solid #e8e8ec;border-radius:10px;padding:16px 18px;display:flex;flex-direction:column;gap:5px")}>
                  <div style={css("font-size:11.5px;color:#8e8e99")}>Review velocity</div>
                  <div style={css("font-size:30px;font-weight:600;letter-spacing:-0.03em;font-variant-numeric:tabular-nums")}>5.4</div>
                  <div style={css("font-size:11.5px;color:#8e8e99;font-variant-numeric:tabular-nums")}>per week · median 11.4</div>
                </div>
              </div>
    
              <div style={css("background:#ffffff;border:1px solid #e8e8ec;border-radius:10px;overflow:hidden")}>
                <div style={css("padding:14px 18px;border-bottom:1px solid #f0f0f3;font-size:13px;font-weight:600")}>Findings</div>
                {findings.map((f, _i) => (
    <Fragment key={_i}>
    
                  <div style={css("border-bottom:1px solid #f4f4f6;padding:16px 18px;display:flex;flex-direction:column;gap:10px")}>
                    <div style={css("display:flex;align-items:flex-start;gap:12px")}>
                      <span style={{ fontSize: "11px", fontWeight: "600", letterSpacing: "0.04em", textTransform: "uppercase", padding: "3px 7px", borderRadius: "4px", color: f.sevColor, background: f.sevBg, flex: "0 0 auto", marginTop: "1px" }}>{f.sev}</span>
                      <div style={css("display:flex;flex-direction:column;gap:5px;flex:1")}>
                        <div style={css("font-size:14px;font-weight:600;letter-spacing:-0.01em;text-wrap:pretty")}>{f.title}</div>
                        <div style={css("font-size:12.5px;color:#5c5c66;text-wrap:pretty;max-width:760px")}>{f.desc}</div>
                      </div>
                    </div>
                    <div style={css("display:flex;gap:10px;align-items:stretch;margin-left:70px")}>
                      <div style={css("width:3px;background:#4b45c6;border-radius:2px;flex:0 0 3px")}></div>
                      <div style={css("display:flex;flex-direction:column;gap:3px")}>
                        <div style={css("font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#a8a8b2;font-weight:600")}>What it did to your AI visibility</div>
                        <div style={css("font-size:12.5px;color:#16161a;text-wrap:pretty;max-width:720px")}>{f.effect}</div>
                      </div>
                    </div>
                    <div style={css("display:flex;align-items:center;gap:16px;margin-left:70px")}>
                      <HoverButton onClick={f.toggle} style={css("all:unset;cursor:pointer;font-size:12px;font-weight:600;color:#4b45c6")}>{f.caret}</HoverButton>
                      <HoverButton onClick={f.traceGo} style={css("all:unset;cursor:pointer;font-size:12px;color:#5c5c66")} hoverStyle="color:#16161a">{f.traceLabel} →</HoverButton>
                    </div>
                    {f.open && (
    
                      <div style={css("margin-left:70px;background:#fafafb;border:1px solid #f0f0f3;border-radius:8px;padding:12px 14px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px 20px;animation:fadeIn 0.15s ease")}>
                        {f.ev.map((e, _i) => (
    <Fragment key={_i}>
    
                          <div style={css("display:flex;flex-direction:column;gap:2px")}>
                            <span style={css("font-size:11px;color:#8e8e99")}>{e.k}</span>
                            <span style={css("font-size:13px;font-weight:600;font-variant-numeric:tabular-nums")}>{e.v}</span>
                          </div>
                        
    </Fragment>
    ))}
                      </div>
                    
    )}
                  </div>
                
    </Fragment>
    ))}
              </div>
    
              <div style={css("background:#ffffff;border:1px solid #e8e8ec;border-radius:10px;overflow:hidden")}>
                <div style={css("padding:14px 18px;border-bottom:1px solid #f0f0f3;display:flex;align-items:center;justify-content:space-between")}>
                  <div style={css("font-size:13px;font-weight:600")}>Catalogue</div>
                  <div style={css("font-size:11.5px;color:#a8a8b2")}>Amazon + Keepa · through 1 September</div>
                </div>
                <div style={css("display:grid;grid-template-columns:1.5fr 90px 70px 74px 78px 84px 76px;padding:9px 18px;background:#fafafb;border-bottom:1px solid #e8e8ec;font-size:10.5px;letter-spacing:0.06em;text-transform:uppercase;color:#8e8e99;font-weight:600")}>
                  <div>Product</div><div style={css("text-align:right")}>Buy box</div><div style={css("text-align:right")}>Rank</div><div style={css("text-align:right")}>Δ rank</div><div style={css("text-align:right")}>Price</div><div style={css("text-align:right")}>Reviews</div><div style={css("text-align:right")}>Sellers</div>
                </div>
                {products.map((p, _i) => (
    <Fragment key={_i}>
    
                  <div style={css("display:grid;grid-template-columns:1.5fr 90px 70px 74px 78px 84px 76px;padding:12px 18px;border-bottom:1px solid #f4f4f6;align-items:center")}>
                    <div style={css("display:flex;flex-direction:column;gap:1px")}>
                      <span style={css("font-size:13px;font-weight:600")}>{p.name}</span>
                      <span style={css("font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;color:#a8a8b2")}>{p.asin}</span>
                    </div>
                    <div style={{ fontSize: "12.5px", fontWeight: "600", textAlign: "right", color: p.buyboxColor, fontVariantNumeric: "tabular-nums" }}>{p.buybox}</div>
                    <div style={css("font-size:12.5px;text-align:right;font-variant-numeric:tabular-nums")}>{p.rank}</div>
                    <div style={{ fontSize: "12.5px", textAlign: "right", color: p.moveColor, fontVariantNumeric: "tabular-nums" }}>{p.move}</div>
                    <div style={css("font-size:12.5px;text-align:right;font-variant-numeric:tabular-nums")}>{p.price}</div>
                    <div style={css("font-size:12.5px;text-align:right;font-variant-numeric:tabular-nums")}>{p.reviews}</div>
                    <div style={css("font-size:12.5px;text-align:right;font-variant-numeric:tabular-nums")}>{p.sellers}</div>
                  </div>
                
    </Fragment>
    ))}
              </div>
            </div>
          
    )}
    
        </div>
    
        
        {drawer && drawerOpen && (
    
          <div style={css("position:fixed;top:0;right:0;bottom:0;width:560px;background:#ffffff;border-left:1px solid #e8e8ec;box-shadow:-24px 0 48px rgba(20,20,30,0.08);z-index:40;display:flex;flex-direction:column;animation:drawerIn 0.2s cubic-bezier(0.2,0.7,0.3,1)")}>
            <div style={css("padding:18px 26px 14px 26px;border-bottom:1px solid #f0f0f3;display:flex;align-items:flex-start;justify-content:space-between;gap:16px")}>
              <div style={css("display:flex;flex-direction:column;gap:3px")}>
                <div style={css("font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#a8a8b2;font-weight:600")}>{drawer.rank}</div>
                <div style={css("font-size:12px;color:#8e8e99")}>{drawer.area} signal · placeholder data</div>
              </div>
              <HoverButton onClick={drawer.close} style={css("all:unset;cursor:pointer;font-size:12px;color:#8e8e99;padding:2px 6px;border-radius:5px")} hoverStyle="background:#f4f4f6;color:#16161a">Close ✕</HoverButton>
            </div>
    
            <div style={css("flex:1;overflow-y:auto;padding:22px 26px 28px 26px;display:flex;flex-direction:column;gap:22px")}>
              <div style={css("display:flex;flex-direction:column;gap:12px")}>
                <div style={css("font-size:19px;font-weight:600;letter-spacing:-0.02em;text-wrap:pretty")}>{drawer.title}</div>
                <div style={css("display:flex;align-items:center;gap:22px")}>
                  <div style={css("display:flex;flex-direction:column;gap:1px")}>
                    <span style={css("font-size:10.5px;letter-spacing:0.06em;text-transform:uppercase;color:#a8a8b2;font-weight:600")}>Impact</span>
                    <span style={css("font-size:13px;font-weight:600;font-variant-numeric:tabular-nums")}>{drawer.impactNote}</span>
                  </div>
                  <div style={css("display:flex;flex-direction:column;gap:1px")}>
                    <span style={css("font-size:10.5px;letter-spacing:0.06em;text-transform:uppercase;color:#a8a8b2;font-weight:600")}>Effort</span>
                    <span style={css("font-size:13px;font-variant-numeric:tabular-nums")}>{drawer.effort}</span>
                  </div>
                  <HoverButton onClick={drawer.cycle} style={{ all: "unset", cursor: "pointer", marginLeft: "auto", fontSize: "11.5px", fontWeight: "600", padding: "5px 10px", borderRadius: "20px", color: drawer.statusColor, background: drawer.statusBg, border: `1px solid ${drawer.statusBorder}` }}>{drawer.status}</HoverButton>
                </div>
              </div>
    
              <div style={css("display:flex;flex-direction:column;gap:8px")}>
                <div style={css("font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#a8a8b2;font-weight:600")}>Why we suggested this</div>
                <div style={css("font-size:13.5px;color:#16161a;text-wrap:pretty;line-height:1.55")}>{drawer.rationale}</div>
                <div style={css("display:flex;gap:9px;align-items:stretch;margin-top:4px")}>
                  <div style={css("width:3px;background:#4b45c6;border-radius:2px;flex:0 0 3px")}></div>
                  <div style={css("font-size:12px;color:#5c5c66")}>{drawer.link}</div>
                </div>
              </div>
    
              <div style={css("display:flex;flex-direction:column;gap:10px")}>
                <div style={css("display:flex;align-items:center;justify-content:space-between")}>
                  <div style={css("font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#a8a8b2;font-weight:600")}>Supporting data</div>
                  <HoverButton onClick={drawer.toggleDrill} style={css("all:unset;cursor:pointer;font-size:11.5px;font-weight:600;color:#4b45c6")}>{drawer.drillLabel}</HoverButton>
                </div>
                <div style={css("border:1px solid #f0f0f3;border-radius:8px;overflow:hidden")}>
                  {drawer.evidence.map((e, _i) => (
    <Fragment key={_i}>
    
                    <div style={css("display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding:10px 14px;border-bottom:1px solid #f4f4f6")}>
                      <span style={css("font-size:12.5px;color:#5c5c66")}>{e.k}</span>
                      <div style={css("display:flex;flex-direction:column;align-items:flex-end;gap:1px")}>
                        <span style={css("font-size:13px;font-weight:600;font-variant-numeric:tabular-nums")}>{e.v}</span>
                        <span style={css("font-size:11px;color:#a8a8b2;font-variant-numeric:tabular-nums")}>{e.n}</span>
                      </div>
                    </div>
                  
    </Fragment>
    ))}
                </div>
                {drawer.drillOpen && (
    
                  <div style={css("background:#fafafb;border:1px solid #f0f0f3;border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:10px;animation:fadeIn 0.15s ease")}>
                    <div style={css("font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#a8a8b2;font-weight:600")}>Where this came from</div>
                    <div style={css("display:flex;flex-direction:column;gap:7px")}>
                      {drawer.traces.map((t, _i) => (
    <Fragment key={_i}>
    
                        <HoverButton onClick={t.go} style={css("all:unset;cursor:pointer;font-size:12.5px;color:#4b45c6;font-weight:600;display:flex;align-items:center;gap:8px")}>
                          <span style={css("width:5px;height:5px;border-radius:50%;background:#4b45c6")}></span>{t.label} →
                        </HoverButton>
                      
    </Fragment>
    ))}
                    </div>
                    <div style={css("font-size:11.5px;color:#8e8e99;text-wrap:pretty")}>Every number above opens the screen that produced it, and every one of those screens traces back here.</div>
                  </div>
                
    )}
              </div>
    
              <div style={css("display:flex;flex-direction:column;gap:10px")}>
                <div style={css("display:flex;flex-direction:column;gap:2px")}>
                  <div style={css("font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#a8a8b2;font-weight:600")}>How do you want this handled?</div>
                  <div style={css("font-size:12px;color:#8e8e99")}>Change it any time. Nothing is billed by this choice.</div>
                </div>
                <div style={css("display:flex;flex-direction:column;gap:8px")}>
                  {drawer.options.map((o, _i) => (
    <Fragment key={_i}>
    
                    <HoverButton onClick={o.go} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: "11px", border: `1px solid ${o.border}`, background: o.bg, borderRadius: "9px", padding: "13px 15px" }} hoverStyle="border-color:#c9c9d2">
                      <span style={{ width: "15px", height: "15px", borderRadius: "50%", border: `1.5px solid ${o.dotBorder}`, background: o.dot, flex: "0 0 15px", marginTop: "2px", boxShadow: "inset 0 0 0 2.5px #ffffff" }}></span>
                      <span style={css("display:flex;flex-direction:column;gap:2px")}>
                        <span style={{ fontSize: "13.5px", fontWeight: "600", color: o.titleColor }}>{o.label}</span>
                        <span style={css("font-size:12px;color:#5c5c66;text-wrap:pretty")}>{o.body}</span>
                      </span>
                    </HoverButton>
                  
    </Fragment>
    ))}
                </div>
                {drawer.hasChoice && (
    
                  <div style={css("background:#f4f3fd;border:1px solid #dcdbf6;border-radius:8px;padding:12px 14px;display:flex;align-items:center;gap:12px;animation:fadeIn 0.15s ease")}>
                    <div style={css("font-size:12.5px;color:#3a35a8;text-wrap:pretty;flex:1")}>{drawer.chosenAfter}</div>
                    {drawer.showMark && (
    
                      <HoverButton onClick={drawer.markDone} style={css("all:unset;cursor:pointer;font-size:12px;font-weight:600;color:#ffffff;background:#4b45c6;border-radius:6px;padding:6px 12px;flex:0 0 auto")}>Mark complete</HoverButton>
                    
    )}
                  </div>
                
    )}
              </div>
            </div>
          </div>
        
    )}
    
        
        {help && (
    
          <div style={css("position:fixed;top:0;right:0;bottom:0;width:400px;background:#ffffff;border-left:1px solid #e8e8ec;box-shadow:-24px 0 48px rgba(20,20,30,0.08);z-index:50;padding:20px 24px;display:flex;flex-direction:column;gap:18px;animation:drawerIn 0.2s cubic-bezier(0.2,0.7,0.3,1)")}>
            <div style={css("display:flex;align-items:center;justify-content:space-between")}>
              <div style={css("font-size:15px;font-weight:600")}>Help</div>
              <HoverButton onClick={closeHelp} style={css("all:unset;cursor:pointer;font-size:12px;color:#8e8e99")}>Close ✕</HoverButton>
            </div>
            <div style={css("border:1px solid #e8e8ec;border-radius:9px;padding:14px;display:flex;gap:12px;align-items:center")}>
              <div style={css("width:38px;height:38px;border-radius:50%;background:#f1f1f4;flex:0 0 38px")}></div>
              <div style={css("display:flex;flex-direction:column;gap:2px")}>
                <div style={css("font-size:13px;font-weight:600")}>Dana Whitfield</div>
                <div style={css("font-size:11.5px;color:#8e8e99")}>Your liaison · replies in ~2h</div>
              </div>
              <HoverButton style={css("all:unset;cursor:pointer;margin-left:auto;font-size:12px;font-weight:600;color:#4b45c6")}>Message</HoverButton>
            </div>
            <div style={css("display:flex;flex-direction:column;gap:9px")}>
              <div style={css("font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#a8a8b2;font-weight:600")}>Common questions</div>
              <div style={css("font-size:12.5px;color:#5c5c66;border-bottom:1px solid #f4f4f6;padding-bottom:8px")}>Why did my visibility score drop?</div>
              <div style={css("font-size:12.5px;color:#5c5c66;border-bottom:1px solid #f4f4f6;padding-bottom:8px")}>How is Readiness different from Visibility?</div>
              <div style={css("font-size:12.5px;color:#5c5c66;border-bottom:1px solid #f4f4f6;padding-bottom:8px")}>What happens when I choose “Do it for me”?</div>
              <div style={css("font-size:12.5px;color:#5c5c66")}>How often is the data refreshed?</div>
            </div>
            <div style={css("border:1px solid #e8e8ec;border-radius:9px;overflow:hidden")}>
              <div style={css("height:150px;background:repeating-linear-gradient(135deg,#f4f4f6 0 8px,#fafafb 8px 16px);display:flex;align-items:center;justify-content:center")}>
                <div style={css("font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#8e8e99")}>2-min explainer video · placeholder</div>
              </div>
              <div style={css("padding:11px 13px;font-size:12.5px;font-weight:600")}>Reading the Suggestion Engine</div>
            </div>
            <HoverButton style={css("all:unset;cursor:pointer;font-size:12.5px;font-weight:600;color:#4b45c6;border:1px solid #dcdbf6;background:#f4f3fd;border-radius:7px;padding:9px;text-align:center")}>Restart the guided walkthrough</HoverButton>
          </div>
        
    )}
      </div>
    </div>
  );
}
