import { Fig, Kbd, Note, Steps, T, type DocSection } from './parts';

export const SECTIONS_2: DocSection[] = [
  {
    id: 'feasibility',
    group: 'Checking and deciding',
    title: 'Feasibility and compliance',
    body: (
      <>
        <p>The Feasibility tab lists every computed check. Each one names the rules it relies on, shows the measured value against the requirement, and explains any problem.</p>
        <T
          head={['Status', 'Meaning']}
          rows={[
            ['Pass', 'The layout meets the cited rule.'],
            ['Fail', 'It does not. A one-click fix is often offered, and Show on plan highlights the plots or roads involved.'],
            ['Action needed', 'Allowed, but something must be done (for example an NOC is required).'],
            ['Sources conflict', 'Two sources disagree. Choose one in Regulations.'],
            ['Overridden', 'You replaced the rule value with your own, with a reason.'],
            ['Not applicable / Not checked', 'Nothing to check (for example no lake drawn), or the rule does not apply to this authority.'],
          ]}
        />
        <p>Below the checks are the manual document checklist (land-use conformity, conversion, title, gift deeds, BuildNow submission and others), the area statement, the road runs table and the plot mix.</p>
        <p>The ring in the top bar summarises the same checks: green verified, red failing, blue conflict, grey not checked.</p>
        <Fig src="feasibility" alt="Feasibility tab" />
      </>
    ),
  },
  {
    id: 'regulations',
    group: 'Checking and deciding',
    title: 'Regulations',
    body: (
      <>
        <p>The rule library holds 30 rules, each with its GO reference, value, source link, source type and last-verified date.</p>
        <ul>
          <li>
            <b>Conflicts:</b> the cards at the top show rules that disagree (mortgage 15% or 25%, open-space split 9 + 1 or 7.5 + 1 + 1, HMDA frontage 12.2 m or 9 m). Click the one to apply and add a note; the choice is saved with the project.
          </li>
          <li>
            <b>Override:</b> on any rule card, enter your own value and a reason. Checks that use the rule are marked Overridden.
          </li>
          <li>Search and filter by category, authority, status and source.</li>
        </ul>
        <Fig src="regulations" alt="Regulations tab" />
      </>
    ),
  },
  {
    id: 'schedule',
    group: 'Checking and deciding',
    title: 'Plot schedule',
    body: (
      <>
        <p>The Schedule lists every plot: number, nominal size, area in sq yd and m², width, depth, facing, corner or irregular flags, status, price multiplier and price. Click a column header to sort, use the drop-downs to filter by size, facing or status, and group by size or facing to see totals. Click a price to override it. Export to XLSX or CSV from the top of the table.</p>
        <Fig src="schedule" alt="Plot schedule" />
      </>
    ),
  },
  {
    id: 'financials',
    group: 'Checking and deciding',
    title: 'Financials',
    body: (
      <>
        <p>Financials shows revenue, total cost, profit, margin, IRR, NPV, peak funding need and sell-out time, a monthly cash-flow chart and a sensitivity (tornado) chart for rate, cost, sales velocity and mortgage share. Each chart has a data table underneath.</p>
        <Note>
          <p>IRR needs at least one month with negative cash flow. With a land cost of 0 it shows n/a; enter a land cost in Commercials to get a meaningful IRR.</p>
        </Note>
        <Fig src="financials" alt="Financials tab" />
      </>
    ),
  },
  {
    id: '3d',
    group: 'Checking and deciding',
    title: '3D massing',
    body: (
      <>
        <p>The 3D tab builds each house on its plot with setbacks, adds roads and trees, and lights the scene with the real sun for Hyderabad. Use the Date and Time sliders to see shadows through the day and year, drag to orbit, scroll to zoom, and press Fly-through for an automatic tour. Floors and floor height come from the Built form panel.</p>
        <Fig src="3d" alt="3D massing" />
      </>
    ),
  },
  {
    id: 'render',
    group: 'Checking and deciding',
    title: '3D render and sales viewer',
    body: (
      <>
        <p>At the top of the 3D tab, switch from Massing to Render and press Generate render. A detailed scene is built from the current layout in a few seconds: roads with markings and names, the compound wall and entrance gate, gardens and amenities, and, depending on the project type, levelled plot pads, villas built from their setbacks, or a planted farm.</p>
        <p>Use Morning, Noon, Golden and Night (or the sliders) to change the light; Night is blue hour with the street lights on. The cameras are Aerial (drag to orbit), Arrival (a drive in through the gate), Plan (top-down with status colours) and Walk (WASD keys, or the joystick on a phone).</p>
        <p>Type a number in Find a plot to fly to it. Click a plot to see its size, area, facing and price, with Enquire on WhatsApp and Share this plot. Refine filters plots by status, budget, size, facing, road frontage and corner. Layers turns labels, status colours, amenities, future homes and the surroundings on or off; Download saves stills, a short film or a PDF brochure; Info shows the authority, survey numbers, LP number and compliance summary.</p>
        <p>Buyers can open the same view without any editing at <code>/view/&lt;project id&gt;</code>; Share gives the link and an embed code for your website. Add your WhatsApp number and LP number in the project wizard or in Info. Satellite surroundings appear when the parcel was traced on the map or imported; Google 3D surroundings also need a Google Maps key.</p>
      </>
    ),
  },
  {
    id: 'compare',
    group: 'Checking and deciding',
    title: 'Scenarios and comparison',
    body: (
      <>
        <p>A project can hold several scenarios, for example different plot mixes or road widths.</p>
        <Steps>
          <li>Open the scenario menu in the top bar (it shows the current scenario's name).</li>
          <li>Choose New scenario from current, or use the copy icon to duplicate one. Use the pencil to rename and the bin to delete.</li>
          <li>Open the Compare tab, pick scenario A and B, and drag the orange divider across the plan. The table shows the difference in every KPI.</li>
        </Steps>
        <Fig src="compare" alt="Compare tab" />
      </>
    ),
  },
  {
    id: 'export',
    group: 'Sharing',
    title: 'Exports',
    body: (
      <>
        <p>Click Export in the top bar.</p>
        <T
          head={['Format', 'Contents']}
          rows={[
            ['PDF', 'A3 drawing sheet with title block (project, survey numbers, authority, scale, north arrow, date, revision, "Yield study only" stamp), then the area statement, checks, financials and schedule.'],
            ['SVG', 'The plan as a vector drawing in metres.'],
            ['DXF', 'Layered plan for CAD: parcel, plots, plot numbers, open space, utilities, roads, buffers, splays.'],
            ['XLSX', 'Plot schedule and area statement sheets.'],
            ['CSV', 'Plot schedule.'],
            ['GeoJSON', 'Parcel, plots, open space, buffers and roads in latitude/longitude.'],
          ]}
        />
        <Fig src="export" alt="Export drawer" />
      </>
    ),
  },
  {
    id: 'saving',
    group: 'Sharing',
    title: 'Saving, undo and sharing',
    body: (
      <>
        <ul>
          <li>
            <b>Autosave:</b> every change is saved about a second later. The line under the project name shows where (Neon cloud or this browser) and whether the save succeeded.
          </li>
          <li>
            <b>Undo / redo:</b> <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd> and <Kbd>Ctrl</Kbd>+<Kbd>Shift</Kbd>+<Kbd>Z</Kbd> (<Kbd>⌘</Kbd> on Mac), or the arrows in the top bar. A whole slider drag is one step.
          </li>
          <li>
            <b>Share link:</b> the link icon in the top bar copies a link that opens the current scenario in the scratch studio for anyone, without needing an account.
          </li>
          <li>
            <b>Units:</b> switch between m², sq yd and acres/guntas from the command palette. Money is shown in Indian format (lakh and crore).
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'shortcuts',
    group: 'Reference',
    title: 'Keyboard shortcuts',
    body: (
      <>
        <T
          head={['Keys', 'Action']}
          rows={[
            [<><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd> + <Kbd>K</Kbd></>, 'Command palette: search any action, tab, export or scenario'],
            [<Kbd>G</Kbd>, 'Regenerate (replay the animation)'],
            [<Kbd>O</Kbd>, 'Optimize'],
            [<><Kbd>1</Kbd> – <Kbd>8</Kbd></>, 'Switch tabs (Overview, Studio, 3D, Schedule, Feasibility, Financials, Regulations, Compare)'],
            [<><Kbd>[</Kbd> <Kbd>]</Kbd></>, 'Rotate the grid by 5°'],
            [<Kbd>L</Kbd>, 'Lasso tool'],
            [<Kbd>V</Kbd>, 'Select tool'],
            [<Kbd>Esc</Kbd>, 'Cancel drawing, clear highlight'],
            [<><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd> + <Kbd>Z</Kbd></>, 'Undo (add Shift to redo)'],
          ]}
        />
        <Fig src="palette" alt="Command palette" />
      </>
    ),
  },
  {
    id: 'glossary',
    group: 'Reference',
    title: 'Glossary',
    body: (
      <T
        head={['Term', 'Meaning']}
        rows={[
          ['Gunta', '1/40 acre = 121 sq yd = 101.17 m².'],
          ['ROW', 'Right of way: the full road width between plot boundaries.'],
          ['Splay', 'The triangle cut from a plot corner at a road junction so vehicles can see round the corner.'],
          ['FTL', 'Full tank level: the edge of a lake from which its buffer is measured.'],
          ['Master-plan give-up', 'The strip of your land needed to widen the approach road to its master-plan width.'],
          ['Mortgage plots', 'Plots registered to the authority until development works are complete; they cannot be sold until released.'],
          ['Net layout area', 'Gross area minus the master-plan give-up and road-affected strip; the open-space percentage is measured on it.'],
          ['Saleable %', 'Plotted area as a share of gross area.'],
        ]}
      />
    ),
  },
  {
    id: 'faq',
    group: 'Reference',
    title: 'Questions and troubleshooting',
    body: (
      <>
        <h3>No plots appear</h3>
        <p>The plan shows the three changes most likely to help (shorter blocks, smaller depth, more plot sizes); click one to apply it. Very small or narrow parcels may not fit a block.</p>
        <h3>The top bar says "save failed"</h3>
        <p>The cloud database could not be reached. Keep the tab open and make another change to retry; your work is still in the page. If it persists, check the server's /v1/health page.</p>
        <h3>A check says Sources conflict</h3>
        <p>Two official sources give different values. Open Regulations, pick the one your authority applies, and add a note.</p>
        <h3>The satellite map is blank</h3>
        <p>The imagery service is blocked or offline on your network. You can still click points, or import a GeoJSON or KML boundary instead.</p>
        <h3>Can I submit the drawing to the authority?</h3>
        <p>No. Use LandPlan Studio to test yield and feasibility, then have a licensed technical person prepare the submission drawings.</p>
      </>
    ),
  },
];
