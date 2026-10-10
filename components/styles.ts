// Tailwind class lists for patterns shared by several pages and components.
// `mobile:` is ≤760px and `phone:` is ≤640px (custom variants in app/globals.css).
import { cn } from "@/lib/utils";

// Page shell
export const topbar = "bg-card border-b border-line border-t-[5px] border-t-taiko-red";
export const topbarInner = "max-w-[1180px] min-h-[74px] m-auto flex items-center gap-[18px] px-7 mobile:px-[18px] mobile:min-h-16 mobile:gap-3";
export const brand = "flex min-w-0 shrink-0 items-center gap-2.5 font-bold text-[21px] tracking-[-0.6px] mobile:text-[18px]";
export const brandIcon = "flex text-taiko-blue";
export const edition = "text-[14px] font-[450] border-l border-line pl-3.5 ml-[5px] tracking-normal mobile:hidden";
export const localTag = "text-[12px] py-[3px] px-2 bg-secondary border border-line rounded-[6px] text-muted-foreground mobile:text-[10px]";
export const login = "ml-auto inline-flex items-center justify-center gap-[7px] text-[14px] text-foreground py-2 px-3 min-h-11 rounded-[9px] border border-ink bg-soft-yellow shadow-[0_2px_0_#382d2a] mobile:[&_span]:hidden";
export const container = "max-w-[1180px] m-auto px-7 mobile:px-[18px]";
export const footer = "flex justify-between flex-wrap items-center gap-[15px] py-8 mt-10 border-t border-line text-muted-foreground text-[12px] mobile:flex-col mobile:items-start";
export const footerBrand = "flex items-center gap-[7px]";

// Buttons
export const primaryButton = "inline-flex justify-center items-center gap-2 bg-primary text-white border-2 border-ink rounded-[9px] py-2.5 px-6 text-[14px] font-semibold min-h-11 shadow-[0_3px_0_#382d2a] motion-safe:hover:-translate-y-0.5 hover:bg-[#a52f24] motion-safe:active:translate-y-[3px] active:shadow-none disabled:translate-y-0 disabled:shadow-none";
export const secondaryButton = "inline-flex items-center justify-center gap-2 min-h-11 py-2.5 px-[17px] bg-soft-yellow border-2 border-ink rounded-[9px] text-[13px] text-foreground font-semibold shadow-[0_3px_0_#382d2a] motion-safe:hover:-translate-y-0.5 hover:bg-[#f9e6ad] motion-safe:active:translate-y-[3px] active:shadow-none disabled:translate-y-0 disabled:shadow-none";
export const textButton = "inline-flex items-center gap-1.5 py-2.5 min-h-11 text-primary text-[13px]";
export const galleryButton = "inline-flex items-center justify-center gap-2 mt-[18px] py-2.5 px-[18px] min-h-11 rounded-[9px] border-2 border-ink bg-soft-blue text-foreground text-[14px] font-medium shadow-[0_3px_0_#382d2a] motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[3px] active:shadow-none";
export const muted = "text-[12px]!";
// Paragraphs inside the CenturyLink admin panel.
export const adminText = "max-w-[430px] text-muted-foreground text-[14px]";

// Event header and navigation
export const eventHead = "relative flex items-center justify-between pt-12 pb-10 gap-6 mobile:py-7";
export const eventKicker = "text-[11px] tracking-[2px] text-taiko-blue font-semibold mobile:text-[10px] mobile:tracking-[1px]";
export const eventTitle = "text-[38px] mt-2 mb-[15px] text-foreground leading-[1.3] mobile:text-[28px] mobile:mb-3";
export const editionNo = "inline-block whitespace-nowrap font-normal text-taiko-red text-[28px] ml-4 mobile:text-[23px] mobile:ml-2";
export const eventDetails = "flex gap-5 text-[14px] text-muted-foreground mobile:flex-col mobile:gap-1.5 mobile:text-[12px]";
export const eventDetail = "flex gap-[7px] items-center";
export const eventFormat = "flex gap-7 p-5 bg-soft-yellow border border-line rounded-[14px] mobile:hidden";
export const eventFormatItem = "text-[24px] font-[550] tracking-[-1px]";
export const eventFormatLabel = "block text-[12px] text-muted-foreground font-normal tracking-normal mt-[3px]";
export const workspaceNav = "flex items-center justify-between border-b-2 border-line pb-3.5 mobile:pb-3 mobile:flex-wrap mobile:gap-4";
export const workspaceTabs = "mobile:w-full";
export const mainTabs = "gap-6! h-auto! min-h-11 p-0! mobile:w-full mobile:justify-between mobile:gap-0.5!";
export const mainTab = "min-h-11 py-1.5! px-1! border-0! text-[15px] text-muted-foreground data-[state=active]:text-primary! after:bg-primary! after:bottom-[-15px]! [&_svg]:mr-[5px] mobile:text-[12px]! mobile:shrink-0 mobile:after:bottom-[-14px]! mobile:[&_svg]:hidden";
export const syncLabel = "flex items-center gap-[7px] text-[12px] text-muted-foreground mobile:hidden mobile:text-[10px] mobile:gap-1";
export const syncDot = "h-[5px] w-[5px] rounded-[50%] bg-[#008b49]";
export const mobileRounds = "hidden! mobile:flex! mobile:mb-[18px]";
export const mobileRoundsList = "mobile:h-11! mobile:w-full mobile:rounded-[10px]";
export const mobileRoundsTab = "mobile:text-[12px] mobile:py-[9px] mobile:px-[7px]";

// Section headings
export const sectionHeading = "flex justify-between items-center mb-4 gap-[15px]";
export const sectionTitle = "text-[19px] flex items-center gap-2 mobile:text-[17px] [&_svg]:text-primary";
export const sectionNote = "text-[12px] text-muted-foreground mobile:text-[11px]";
export const count = "bg-soft-blue text-taiko-blue text-[12px] py-px px-[7px] rounded-[6px] ml-1";
export const dot = "inline-block w-[5px] h-[5px] rounded-[50%] bg-current";

// Bracket match cards
export const bracketSection = "mt-[34px] mobile:mt-7";
export const roundTitle = "flex items-center justify-between text-muted-foreground text-[13px] mb-3.5";
export const roundTitleNote = "text-muted-foreground text-[11px]";
export const matchSlot = "min-w-0";
export const matchCard = "relative block w-full bg-card border border-line rounded-[12px] py-3 px-3 text-left min-h-[99px] shadow-[0_3px_0_#e7dfd4] hover:border-taiko-blue hover:bg-soft-blue/40 mobile:min-h-[113px] mobile:py-[13px] mobile:px-4 mobile:rounded-[14px]";
export const matchLive = "border-taiko-blue bg-soft-blue";
export const matchConnector = "after:content-[''] after:absolute after:right-[-24px] after:top-1/2 after:w-[23px] after:border-t after:border-line mobile:after:hidden";
export const matchMeta = "flex justify-between items-center text-[10px] text-muted-foreground mb-2 gap-1 mobile:text-[11px] mobile:mb-2.5";
export const matchStatus = "flex gap-1 items-center";
export const player = "flex items-center gap-1.5 text-[13px] min-h-9 leading-[1.25] mobile:min-h-7 mobile:text-[15px]";
export const seed = "text-[10px] text-muted-foreground w-3.5 tabular-nums mobile:text-[11px] mobile:w-5";
export const playerProfile = "flex flex-col gap-[3px] flex-1 min-w-0 py-[3px]";
export const playerName = "overflow-hidden whitespace-nowrap text-ellipsis flex-1";
export const winnerText = "text-taiko-blue font-semibold";
export const score = "text-[11px] text-muted-foreground tabular-nums shrink-0 mobile:text-[14px]";
export const bracketLegend = "flex gap-[18px] my-5 text-[11px] text-muted-foreground mobile:text-[10px] mobile:flex-wrap mobile:gap-2.5";
export const legendItem = "flex items-center gap-1.5";
export const legendNote = "flex items-center gap-1.5 ml-auto mobile:ml-0 mobile:basis-full";
export const emptyLive = "flex flex-col gap-2.5 items-center justify-center bg-card border border-dashed border-line rounded-[15px] text-muted-foreground min-h-[180px] text-[14px] p-[22px] text-center";

// Song lists and rules
export const songNote = "text-muted-foreground text-[12px] mb-[18px]";
export const songList = "bg-card rounded-[15px] border border-line px-6 mobile:px-4";
export const songRow = "flex gap-[18px] items-center py-5 border-b border-line last:border-b-0 mobile:gap-2.5 mobile:py-[19px]";
export const songIndex = "text-[12px] text-muted-foreground w-[22px] mobile:text-[11px] mobile:w-4";
export const songIcon = "text-muted-foreground mobile:hidden";
export const songTitle = "flex-1 font-medium wrap-anywhere mobile:text-[14px]";
export const songTag = "ml-2.5 text-[11px] text-muted-foreground bg-secondary py-1 px-1.5 rounded-[4px] mobile:text-[10px] mobile:inline-block";
export const stars = "text-primary text-[14px] font-semibold whitespace-nowrap mobile:text-[12px]";
export const designated = "py-[27px] flex gap-[18px] items-center text-muted-foreground";
export const designatedTitle = "text-[15px] text-foreground mb-1";
export const designatedText = "text-[13px]";
export const rules = "py-3";
export const rulesTitle = "text-[30px] mb-2.5 mobile:text-[25px]";
export const rulesLede = "text-muted-foreground text-[15px] mobile:text-[14px]";
export const ruleGrid = "grid grid-cols-2 gap-5 mt-7 mobile:grid-cols-[1fr] mobile:gap-3.5";
export const ruleCard = "p-[30px] bg-card border border-line shadow-[0_3px_0_#e7dfd4] rounded-[15px] mobile:p-6";
export const ruleNo = "text-[12px] text-primary";
export const ruleTitle = "text-[20px] mt-[15px] mb-2.5";
export const ruleText = "text-muted-foreground text-[14px] leading-[1.9]";
export const ruleLink = "text-primary flex gap-1 items-center text-[14px] mt-3";

// Match detail sheet
export const matchSheet = "w-[560px]! max-w-[560px]! gap-0! bg-card! mobile:w-screen! mobile:max-w-[100vw]!";
export const sheetHeader = "pt-7! px-[26px]! pb-[22px]! border-b border-line";
export const sheetTitle = "text-[19px]";
export const sheetDescription = "text-[13px] leading-[calc(1.25/0.875)]";
export const sheetBody = "overflow-auto pt-[25px] px-[25px] pb-[calc(25px+env(safe-area-inset-bottom))] flex-1 mobile:pt-5 mobile:px-[18px] mobile:pb-10";
export const contestants = "grid grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] items-center gap-2 text-center";
export const contestantName = "mb-[5px] text-[20px] wrap-anywhere";
export const contestantsVs = "col-start-2 row-start-1 text-[11px] text-muted-foreground";
export const ratingSource = "mt-3 mb-6 text-muted-foreground text-[11px] text-center";
export const playerRating = "block text-muted-foreground text-[11px] font-medium leading-[1.4] whitespace-nowrap tabular-nums";

// Read-only match records
export const resultBox = "bg-accent text-primary rounded-[14px] p-7 text-center [&>svg]:mx-auto [&>svg]:mb-3";
export const resultTitle = "text-[22px]";
export const resultText = "text-[13px] mt-2";
export const summaryHeading = "text-[16px] font-semibold mb-3";
export const summarySection = "mt-6";
export const selectionRecord = "mt-3 p-3.5 border border-line rounded-[12px] text-[13px] wrap-anywhere";
export const selectionName = "font-semibold mb-2";
export const selectionItem = "flex items-baseline justify-between gap-2 my-1.5";
export const selectionBanned = "text-[#a23a3a] whitespace-nowrap";
export const selectionNote = "text-muted-foreground mt-2";
export const scoreTable = "w-full table-fixed border-collapse text-[12px]";
export const scoreCell = "py-3 px-1 border-b border-line text-right wrap-anywhere tabular-nums";
export const scoreSongCell = cn(scoreCell, "text-left! w-[42%]");
export const scoreCellNote = "block text-muted-foreground font-normal mb-[5px]";
export const scoreTotals = "font-semibold text-primary";

// Score editors
export const editor = "border-0 p-0 m-0 min-w-0 [&:disabled_button]:opacity-50 [&:disabled_button]:cursor-not-allowed";
export const privateNote = "flex items-center gap-[7px] text-[12px] text-muted-foreground bg-secondary p-3 rounded-[9px] mb-7";
export const formHeading = "flex items-center justify-between mt-6 mb-4";
export const formHeadingTitle = "text-muted-foreground text-[13px]";
export const formHeadingName = "text-foreground text-[17px] ml-2";
export const formHeadingNote = "text-[11px] text-muted-foreground";
export const pickSides = "grid grid-cols-2 gap-[18px] mobile:gap-3";
export const pickSide = "min-w-0";
export const pickSideName = "mb-[15px] text-[15px] font-semibold wrap-anywhere";
export const pickerLabel = "flex flex-col gap-[7px] mb-[13px] min-w-0 [&>[data-slot=native-select-wrapper]]:w-full [&>[data-slot=native-select-wrapper]]:min-w-0";
export const pickerLabelText = "text-[12px] text-muted-foreground";
export const songPicker = "block w-full! bg-card! border! border-line! shadow-none! rounded-[8px]! min-h-11! text-[13px]! whitespace-nowrap! text-left! pr-9 overflow-hidden text-ellipsis mobile:text-[16px]!";
export const editorInline = "flex gap-4 items-end mt-2.5 [&>label]:flex-1 [&>label]:m-0";
export const editorInlineButton = "mobile:text-[12px] mobile:p-3";
export const formHelp = "text-[13px] text-muted-foreground leading-[1.8] my-3.5";
export const scoreGrid = "grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2.5 items-center";
export const scoreColumnHead = cn(scoreGrid, "text-[11px] text-muted-foreground mb-2.5 [&>span:not(:first-child)]:text-right [&>span:not(:first-child)]:overflow-hidden [&>span:not(:first-child)]:text-ellipsis");
export const scoreInputRow = cn(scoreGrid, "py-[13px] border-t border-line");
export const scoreSong = "flex flex-col gap-[3px] text-[13px] wrap-anywhere";
export const scoreSongNote = "text-[10px] text-muted-foreground";
export const scoreInput = "bg-secondary border border-line rounded-[9px] min-w-0 w-full text-[15px] min-h-11 py-2.5 px-[7px] text-right tabular-nums placeholder:text-[12px] [&::-webkit-inner-spin-button]:hidden mobile:text-[16px]";
export const totalRow = cn(scoreGrid, "border-t border-line pt-[17px] pb-3 text-[13px]");
export const totalValue = "text-right text-primary text-[16px] tabular-nums mobile:text-[15px]";
export const editorActions = "grid grid-cols-2 gap-3 my-6 [&_button]:py-3 [&_button]:px-3.5";
export const byeArea = "mt-7 pt-[22px] border-t border-line";
export const byeTitle = "text-[15px]";
export const byeText = "text-[12px] text-muted-foreground mt-2 mb-[17px]";
export const formError = "p-3.5 bg-[#fff0ef] text-[#b0352c] rounded-[10px] text-[13px] sticky bottom-0";

// Roster management
export const playerManager = "w-full mt-7 text-left [&_button:disabled]:opacity-50 [&_button:disabled]:cursor-not-allowed";
export const playerManagerHeading = cn(sectionHeading, "flex-wrap gap-3 phone:items-start");
export const playerEditForm = "my-4 p-4 border border-line rounded-[8px] grid gap-3";
export const playerEditLabel = "grid gap-1.5 text-[13px]";
export const playerEditInput = "w-full border border-line p-2.5 rounded-[6px] phone:text-[16px]";
export const playerFormActions = "flex gap-2.5";
export const rosterList = "grid grid-cols-2 gap-2 phone:grid-cols-1";
export const rosterRow = "flex gap-2.5 items-center p-2.5 border border-line rounded-[8px] min-w-0";
export const rosterProfile = cn(playerProfile, "wrap-anywhere");

// Gallery pages (paper palette: `g-*` colors in app/globals.css)
export const galleryPage = "min-h-screen bg-g-bg text-g-text";
export const galleryWrap = "max-w-[1180px] mx-auto px-7 mobile:px-[18px]";
export const galleryKicker = "text-g-muted text-[12px] font-semibold tracking-[0.14em] uppercase";
export const galleryLede = "max-w-[56ch] text-g-soft text-[18px] leading-[1.75] mobile:text-[16px]";
export const galleryMeta = "flex flex-wrap gap-y-2 gap-x-[22px] text-g-soft text-[14px]";
export const galleryMetaItem = "inline-flex items-center gap-[7px]";
export const galleryPill = "inline-flex items-center justify-center gap-1.5 py-2.5 px-5 rounded-[9px] border-2 border-ink bg-soft-yellow text-ink text-[14px] font-semibold shadow-[0_3px_0_#382d2a] motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[3px] active:shadow-none";
export const galleryPillGhost = "bg-card text-ink hover:bg-soft-blue";
export const galleryFooter = "flex flex-wrap justify-between gap-5 mt-16 pt-8 pb-10 border-t border-line text-g-muted text-[12px] mobile:flex-col";
