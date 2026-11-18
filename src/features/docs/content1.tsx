import { link } from '@/router';
import { Fig, Kbd, Note, Steps, T, type DocSection } from './parts';

const A = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <a {...link(to)} className="text-blueprint underline underline-offset-2 hover:text-signal-ink">
    {children}
  </a>
);

export const SECTIONS_1: DocSection[] = [
  {
    id: 'introduction',
    group: 'Getting started',
    title: 'Introduction',
    body: (
      <>
        <p>
          LandPlan Studio turns a land parcel into a plotted layout in a few seconds. You describe the land and your rates, press Generate, and get roads, blocks, plots, parks, utilities and buffers, together with the area statement, plot schedule, compliance
          checks and financials. It is built for residential ventures in Telangana under HMDA, DTCP and municipalities following GO Ms 105.
        </p>
        <Note tone="warn">
          <p>
            <b>Every layout is a yield study, not a submission drawing.</b> Rules change by GO; verify each rule against the current text before relying on it.
          </p>
        </Note>
        <p>Everything runs in your browser, so results appear as you change a value. Projects are saved to the cloud database when one is connected, otherwise in this browser.</p>
      </>
    ),
  },
  {
    id: 'quick-start',
    group: 'Getting started',
    title: 'Quick start',
    body: (
      <>
        <Steps>
          <li>
            Open <A to="/projects/new">New project</A> (or choose <b>Generate my layout</b> on the home page).
          </li>
          <li>Pick a project type: Residential plots, Gated villa community or Farm plots.</li>
          <li>Enter the project name, location, survey numbers, authority, extent and approach roads.</li>
          <li>Enter your selling rate and development cost, and keep GO 105 standards switched on.</li>
          <li>
            Press <b>Generate layout</b>. When it finishes, the project opens on its Overview dashboard. Open <b>Studio</b> to adjust it.
          </li>
        </Steps>
        <p>
          To explore without saving a project, open the <A to="/studio">scratch studio</A>.
        </p>
      </>
    ),
  },
  {
    id: 'create-project',
    group: 'Getting started',
    title: 'Creating a project',
    body: (
      <>
        <p>The new-project wizard has four steps. Use Continue and Back to move between them; nothing is saved until you generate.</p>
        <h3>1. Type</h3>
        <p>Choose what you are planning. The type sets sensible defaults (plot sizes, depths, road widths, rates) and decides which details the dashboard shows. You can change every value later.</p>
        <Fig src="wizard-type" alt="Choosing a project type" caption="Step 1: pick Residential plots, Gated villa community or Farm plots." />
        <h3>2. Site</h3>
        <T
          head={['Field', 'What to enter']}
          rows={[
            ['Project name', 'Required. Appears on the dashboard, exports and drawing sheet.'],
            ['Location, village', 'Mandal / district and village, for your reference.'],
            ['Survey numbers', 'Printed in the title block of the drawing sheet.'],
            ['Authority', 'HMDA, DTCP, Municipality (GO 105) or Custom. Decides which rules apply.'],
            ['Extent', 'Title area in acres and guntas (1 gunta = 121 sq yd). Used for the parcel size and to reconcile with a drawn boundary.'],
            ['Approach road', 'Existing width and master-plan width. If the existing road is narrower, the widening strip is deducted from your land.'],
            ['Parcel shape', 'A starting shape. Draw, trace or import the exact boundary later in the Studio.'],
          ]}
        />
        <Fig src="wizard-site" alt="Entering site details" caption="Step 2: land details." />
        <h3>3. Rates and rules</h3>
        <p>
          Enter the base selling rate (₹ per sq yd), development cost (₹ per sq yd of gross land) and land cost per acre (0 if you own it). Keep <b>Rule-aware layout (GO 105 standards)</b> on to get junction splays, the 9% park plus 1% utility split, 50 m² / 6 m minimum plots and a 15% mortgage. Villas
          add the number of floors and a clubhouse parcel; farm plots add the plantation.
        </p>
        <Fig src="wizard-plan" alt="Rates and rules step" />
        <h3>4. Generate</h3>
        <p>
          The summary shows a first-pass plot count. Press <b>Generate layout</b>: the engine tries 486 grid orientations and block sizes, shows the best layout as it goes, then saves the project and opens it.
        </p>
        <Fig src="wizard-generate" alt="Generate step" />
      </>
    ),
  },
  {
    id: 'project-types',
    group: 'Getting started',
    title: 'Project types',
    body: (
      <T
        head={['Type', 'Defaults', 'Dashboard details']}
        rows={[
          ['Residential plots', '150–400 sq yd plots, 60 ft depth, 12.2 m roads, GO 105 rules', 'Sellable-now and mortgaged value, price band, corner plots, plot mix, facing, mortgaged plot numbers'],
          ['Gated villa community', '240–500 sq yd villas, 70 ft depth, 18 m spine road, G+1/G+2, optional clubhouse (1%)', 'Villa count, total and average built-up area (sq ft), clubhouse area, premium villas, link to 3D'],
          ['Farm plots', '10–40 gunta plots, 9 m and 12 m farm roads, priced per acre', 'Plots by gunta band, price per acre, farm-road length, green cover, saleable acres, sell-out time'],
        ]}
      />
    ),
  },
  {
    id: 'projects',
    group: 'Getting started',
    title: 'Your projects',
    body: (
      <>
        <p>
          <A to="/projects">Projects</A> lists every project with its type, location, plot count, saleable percentage, revenue and whether any checks are failing. Click a card to open it. Hover a card and use the bin icon to delete it (this cannot be undone).
        </p>
        <p>The top-right corner shows where projects are saved: <b>Synced to Neon</b> (cloud database, available from any browser) or <b>Saved in this browser</b>.</p>
        <Fig src="projects" alt="Projects list" />
      </>
    ),
  },
  {
    id: 'overview',
    group: 'Working on a project',
    title: 'Overview dashboard',
    body: (
      <>
        <p>A project opens on its Overview. It shows the headline numbers (gross area, plots, saleable %, revenue, margin), a preview of the plan, the land-use split, a compliance summary with any open issues, the finance summary and the details for the project type. Click the plan or <b>Open studio</b> to edit.</p>
        <Fig src="overview" alt="Overview dashboard" />
      </>
    ),
  },
  {
    id: 'studio',
    group: 'Working on a project',
    title: 'The Studio',
    body: (
      <>
        <p>The Studio is where you shape the layout. The screen has five parts:</p>
        <T
          head={['Area', 'What it does']}
          rows={[
            ['Top bar', 'Project name, authority, scenario switcher, compliance ring, undo/redo, GO 105, Generate, Optimize, Export, share link, command palette, assistant and theme.'],
            ['Left rail', 'Parameter panels: Site, Constraints, Plot mix, Roads, Open space, Built form, Commercials. Click an icon to open or close a panel.'],
            ['Plan', 'The layout. Plot colours show size bands; hatched plots are mortgaged; the hatched cyan area is a statutory buffer.'],
            ['Inspector', 'Details of the hovered or selected plot, or a summary of the layout when nothing is selected.'],
            ['Bottom dock', 'Live KPIs and the land-use bar.'],
          ]}
        />
        <Fig src="studio" alt="Studio" />
        <h3>Changing parameters</h3>
        <p>Drag a slider or type a value; the layout updates immediately. Each panel covers one topic:</p>
        <T
          head={['Panel', 'Main settings']}
          rows={[
            ['Site', 'Engine mode (v1 parity or rule-aware), parcel shape or source, extent, north offset, authority, approach roads, approach-road edge, road-affected strip, record area, survey numbers, revision.'],
            ['Constraints', 'Draw lakes, nalas, HT lines, railway edges and heritage points; whether buffers count as open space.'],
            ['Plot mix', 'Plot depth, block length, which sizes are used and how often, minimum area and width, mixed depths, width packing, plot numbering.'],
            ['Roads', 'Frontage, spine and boundary road widths; junction splays; automatic upgrade of long roads.'],
            ['Open space', 'Total reservation and the park / utilities / social infrastructure split, placement, minimum pocket.'],
            ['Built form', 'Floors, floor height and setbacks for the 3D view.'],
            ['Commercials', 'Rates, costs, mortgage share and policy, release month, sales velocity, escalation, discount rate, facing and corner premiums.'],
          ]}
        />
        <h3>Moving around the plan</h3>
        <ul>
          <li>Scroll to zoom; drag to pan. Use the toolbar on the right for zoom in, zoom out and fit.</li>
          <li>Hover a plot to see its number, size, dimensions, facing and price.</li>
          <li>Click a plot to pin it in the Inspector, where you can set its status (Available, Held, Booked, Sold, Mortgaged) and override its price.</li>
          <li>
            Hold <Kbd>Shift</Kbd> and drag, or press <Kbd>L</Kbd>, to lasso several plots and change their status together.
          </li>
          <li>
            Press <Kbd>[</Kbd> or <Kbd>]</Kbd> to rotate the grid by 5°, and <Kbd>G</Kbd> to replay the generate animation.
          </li>
        </ul>
        <h3>Drawing the exact boundary</h3>
        <ul>
          <li>
            <b>Draw:</b> Site panel → Parcel source → Draw → Edit on plan. Drag the orange squares to move corners, click a round midpoint to add a corner, <Kbd>Alt</Kbd>-click a corner to delete it. Corners snap to 1 m.
          </li>
          <li>
            <b>Trace on satellite:</b> Site → Draw → Trace on map. Click the corners on the imagery, then <b>Use as parcel</b>.
          </li>
          <li>
            <b>Bearings:</b> Site → Bearings. Enter each leg's whole-circle bearing and distance; the closing error is shown.
          </li>
          <li>
            <b>Import:</b> Site → Import. Choose a GeoJSON, KML or DXF file; the first closed polygon is used.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'constraints',
    group: 'Working on a project',
    title: 'Lakes, nalas and other constraints',
    body: (
      <>
        <p>Constraints add statutory buffers that are removed from the land you can plot.</p>
        <Steps>
          <li>Open the Constraints panel and choose Lake FTL, Nala, HT line, Railway edge or Heritage point.</li>
          <li>Click points on the plan. For a lake, click the outline and press Enter or double-click to close it. For a heritage point, click once.</li>
          <li>Adjust the details in the panel: lake area (the whole water body, which decides 30 m or 9 m), nala width, HT voltage and tower base.</li>
        </Steps>
        <T
          head={['Constraint', 'Buffer applied', 'Rule']}
          rows={[
            ['Lake of 10 ha or more', '30 m from FTL', 'BF-LAKE-L (GO 168)'],
            ['Lake under 10 ha', '9 m from FTL', 'BF-LAKE-S (GO 168)'],
            ['Nala wider than 10 m / up to 10 m', '9 m / 2 m from the edge', 'BF-NALA-W / BF-NALA-N'],
            ['HT line', 'Tower base width plus 3 m safety', 'HT-SAFE'],
            ['Railway', '30 m', 'BF-RAIL'],
            ['Heritage', 'No plots within 100 m; 100–200 m flagged for NMA permission', 'HER-ASI'],
          ]}
        />
        <Fig src="studio-lake" alt="A lake with its 30 m buffer" caption="A 12 ha lake drawn on the plan: plots inside the 30 m buffer are removed and the buffer appears in the area statement." />
      </>
    ),
  },
  {
    id: 'optimizer',
    group: 'Working on a project',
    title: 'Optimizer',
    body: (
      <>
        <p>
          Press <b>Optimize</b> (or <Kbd>O</Kbd>) to search 486 combinations of grid angle, block length and offsets for the most plotted area. The heatmap fills in as results arrive; the brightest cell is the best. The scatter chart compares yield with margin, coloured by failing checks. Click any cell or point to load that layout. Cancel stops the search.
        </p>
        <p>Sites over 60 acres are optimised on the server, which is faster for large parcels.</p>
        <Fig src="optimizer" alt="Optimizer drawer" />
      </>
    ),
  },
];
