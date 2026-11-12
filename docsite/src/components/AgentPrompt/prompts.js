/**
 * The copy-to-your-agent prompts.
 *
 * Two shapes. A goal prompt opens with what the user wants built, then installs the skill; the
 * skill holds the questions to ask and the know-how, so the prompt stays short and never goes
 * stale. A skills prompt is for giving an agent SheetXL with no particular build in mind.
 *
 * `SKILLS_PROMPT` is also the prompt in the repo README; keep the two identical.
 */

export const SKILLS_INSTALL = 'npx -y skills add sheetxl/skills -g --all';

const UPGRADE_LINE = "I'd like to upgrade your spreadsheet skills with SheetXL:";

const upgrade = (commands, task) => `${UPGRADE_LINE}\n${commands.join('\n')}\n\nThen ${task}`;

const goal = (want) =>
  `I would like to ${want}.\n\nPlease use SheetXL:\n${SKILLS_INSTALL}\n\nRead the SheetXL skill, then ask me what I need before you build.`;

export const SKILLS_PROMPT = upgrade([SKILLS_INSTALL], 'give me a quick intro to the new things you can do.');

/** The MCP server's launch line, as every client's config carries it. */
export const MCP_LAUNCH = { command: 'npx', args: ['-y', '@sheetxl/mcp'] };

export const PROMPTS = {
  agent: SKILLS_PROMPT,

  app: goal('build a full spreadsheet app'),
  grid: goal('put a spreadsheet grid inside my app'),
  page: goal('add a spreadsheet to a web page'),
  automate: goal('automate my spreadsheet files with code'),
  terminal: goal('work with my spreadsheet files from the terminal'),

  vscode: upgrade(
    ['code --install-extension sheetxl.sheetxl-vscode --pre-release'],
    'tell me how to open a spreadsheet with it and work on it together.',
  ),
  mcp: upgrade(
    ['npx -y sheetxl setup agent'],
    'register the SheetXL MCP server with the client you are running in, using the commands it prints, and tell me what to restart so the SheetXL tools connect.',
  ),
  mcpClaudeCode: upgrade(
    ['claude plugin marketplace add sheetxl/skills', 'claude plugin install sheetxl@sheetxl'],
    'tell me what to restart so the SheetXL tools connect.',
  ),
  mcpCodex: upgrade(
    ['codex plugin marketplace add sheetxl/skills', 'codex plugin add sheetxl@sheetxl'],
    'tell me what to restart so the SheetXL tools connect.',
  ),
};

/** The things people come to build, for the use-case cards. */
export const USE_CASES = [
  {
    id: 'app',
    title: 'A full spreadsheet app',
    description: 'Toolbar, formula bar, menus, and dialogs. The whole spreadsheet, in your product.',
    href: './react',
  },
  {
    id: 'grid',
    title: 'A grid inside my app',
    description: 'Just the sheet, with your own buttons and design around it.',
    href: './react',
  },
  {
    id: 'page',
    title: 'A spreadsheet on a web page',
    description: 'One script tag on any HTML page. No build step, no framework.',
    href: './vanilla',
  },
  {
    id: 'automate',
    title: 'Automate spreadsheet files',
    description: 'Read, calculate, and write workbooks from Node: scripts, services, and jobs.',
    href: './node',
  },
];

/** One-click MCP install links. Each client shows the configuration before installing it. */
export const MCP_LINKS = {
  cursor: `cursor://anysphere.cursor-deeplink/mcp/install?name=sheetxl&config=${btoa(JSON.stringify(MCP_LAUNCH))}`,
  vscode: `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: 'sheetxl', ...MCP_LAUNCH }))}`,
};
