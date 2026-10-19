# shellcheck shell=bash
# shellcheck disable=SC2034  # menu registries are read via nameref in ui_loop
# grokbot-relay TUI. Sourced by bin/grokbot-relay; uses its cmd_* functions.

# Backend: gum (private binary in /opt/grokbot-relay/bin) > whiptail > dialog > plain.
# --plain, NO_COLOR or GRB_UI=plain forces the plain backend.

GUM=""
ui_detect() {
  GUM=""
  if [[ -n "${NO_COLOR:-}" || "${GRB_UI:-}" == plain || "${GRB_PLAIN:-0}" == 1 ]]; then UI=plain; return; fi
  local g
  for g in "$(self_dir)/gum" "$APP_DIR/bin/gum"; do
    if [[ -x "$g" ]]; then GUM="$g"; break; fi
  done
  if [[ -n "$GUM" && "${GRB_UI:-}" != whiptail ]]; then UI=gum; [[ -t 1 ]] && export CLICOLOR_FORCE=1
  elif command -v whiptail >/dev/null 2>&1; then UI=whiptail
  elif command -v dialog >/dev/null 2>&1; then UI=dialog
  else UI=plain; fi
}
UI=plain
ui_detect
UI_TITLE="grokbot-relay"
UI_H=20; UI_W=74
UI_STEP=""   # wizard progress, e.g. "2/8 Node runtime"

# Palette: electric violet + cyan on the terminal's dark background.
C_VIOLET="#A78BFA"; C_VIOLET2="#7C3AED"; C_CYAN="#22D3EE"; C_DIM="#6B7280"; C_TEXT="#E5E7EB"
C_OK="#34D399"; C_BAD="#F87171"; C_WARN="#FBBF24"
export GUM_CHOOSE_CURSOR_FOREGROUND="$C_CYAN" GUM_CHOOSE_HEADER_FOREGROUND="$C_VIOLET" \
  GUM_CHOOSE_SELECTED_FOREGROUND="$C_CYAN" GUM_CHOOSE_ITEM_FOREGROUND="$C_TEXT" \
  GUM_INPUT_CURSOR_FOREGROUND="$C_CYAN" GUM_INPUT_PROMPT_FOREGROUND="$C_VIOLET" \
  GUM_INPUT_HEADER_FOREGROUND="$C_VIOLET" GUM_INPUT_PLACEHOLDER_FOREGROUND="$C_DIM" \
  GUM_CONFIRM_PROMPT_FOREGROUND="$C_TEXT" GUM_CONFIRM_SELECTED_BACKGROUND="$C_VIOLET2" \
  GUM_CONFIRM_SELECTED_FOREGROUND="#FFFFFF" GUM_CONFIRM_UNSELECTED_BACKGROUND="#1F2937" \
  GUM_CONFIRM_UNSELECTED_FOREGROUND="$C_DIM" GUM_SPIN_SPINNER_FOREGROUND="$C_CYAN" \
  GUM_SPIN_TITLE_FOREGROUND="$C_TEXT"

g_style() { "$GUM" style "$@"; }

# Status for the header (values readable as root or grokbot group; "?" otherwise)
ui_status_line() {
  local state port bots ver
  ver="$(read_version "$(script_root)")"
  if [[ "${GRB_DEMO:-0}" == 1 ]]; then state=online; port=3000; bots=3
  else
    if systemctl is-active --quiet "$UNIT_NAME" 2>/dev/null; then state=online; else state=offline; fi
    port="?"; [[ -r "$ENV_FILE" ]] && port="$(env_value GROKBOT_RELAY_PORT)"
    bots="?"; [[ -r "$AGENTS_FILE" ]] && bots="$(agents_js list 2>/dev/null | grep -vc '^(' || true)"
  fi
  local dot
  if [[ $state == online ]]; then dot="$(g_style --foreground "$C_OK" --bold "● online")"
  else dot="$(g_style --foreground "$C_BAD" --bold "○ offline")"; fi
  printf '%s  %s  %s  %s' "$dot" \
    "$(g_style --foreground "$C_DIM" "port") $(g_style --foreground "$C_TEXT" "127.0.0.1:$port")" \
    "$(g_style --foreground "$C_DIM" "bots") $(g_style --foreground "$C_TEXT" "$bots")" \
    "$(g_style --foreground "$C_DIM" "v$ver")"
}

ui_header() {
  [[ "$UI" == gum ]] || return 0
  clear 2>/dev/null || true
  local mark sig status
  mark="$(g_style --bold --foreground "$C_VIOLET" "● grokbot")$(g_style --bold --foreground "$C_CYAN" "·relay")"
  sig="$(g_style --foreground "$C_DIM" "claude · codex ")$(g_style --foreground "$C_CYAN" "↔ ))) ")$(g_style --foreground "$C_VIOLET" "●")$(g_style --foreground "$C_CYAN" " ((( ↔")$(g_style --foreground "$C_DIM" " grok bots")"
  status="$(ui_status_line)"
  g_style --border rounded --border-foreground "$C_VIOLET2" --padding "0 2" --margin "1 1 0 1" \
    "$mark" "$sig" "" "$status"
  if [[ -n "$UI_STEP" ]]; then
    local n="${UI_STEP%%/*}" rest="${UI_STEP#*/}"; local tot="${rest%% *}" label="${rest#* }"
    local w=28 fill bar=""; fill=$(( n * w / tot ))
    local i; for ((i=0;i<w;i++)); do if (( i < fill )); then bar+="━"; else bar+="─"; fi; done
    printf '  %s %s  %s\n' "$(g_style --foreground "$C_CYAN" --bold "[$n/$tot]")" \
      "$(g_style --foreground "$C_TEXT" --bold "$label")" \
      "$(g_style --foreground "$C_VIOLET" "${bar:0:fill}")$(g_style --foreground "#374151" "${bar:fill}")"
  fi
  echo
}

g_box() { # color, text (with \n escapes)
  local txt; txt="$(printf '%b' "$2")"
  g_style --border rounded --border-foreground "$1" --foreground "$C_TEXT" --padding "0 1" --margin "0 1" --width "$UI_W" "$txt"
}
g_wait() { printf '  %s' "$(g_style --foreground "$C_DIM" "↵ continue")"; read -rs _ </dev/tty; echo; }

# ---------------------------------------------------------------- primitives (dispatch)
ui_msg() {
  [[ "$UI" == gum ]] || { legacy_ui_msg "$@"; return; }
  ui_header; g_box "$C_VIOLET2" "$1"; g_wait
}
ui_yesno() {
  [[ "$UI" == gum ]] || { legacy_ui_yesno "$@"; return; }
  ui_header; g_box "$C_VIOLET2" "$1"
  "$GUM" confirm --affirmative "Yes" --negative "No" --default=true "  Continue?"
}
ui_input() {
  [[ "$UI" == gum ]] || { legacy_ui_input "$@"; return; }
  ui_header >&2
  "$GUM" input --header "$(printf '%b' "$1" | sed 's/^/  /')" --prompt "  ❯ " --value "$2" --width "$UI_W" --placeholder "type and press enter"
}
ui_menu() {
  [[ "$UI" == gum ]] || { legacy_ui_menu "$@"; return; }
  local text="$1"; shift
  local -a opts=(); local it
  for it in "$@"; do opts+=("${it#*|}"$'\t'"${it%%|*}"); done
  ui_header >&2
  "$GUM" choose --header "$(printf '%b' "$text" | sed 's/^/  /')" --cursor "  ▸ " --label-delimiter $'\t' \
    --height 14 "${opts[@]}"
}
ui_run() {
  [[ "$UI" == gum ]] || { legacy_ui_run "$@"; return; }
  local title="$1"; shift
  local out rc=0 tmp; tmp="$(mktemp)"
  ui_header
  ( "$@" ) >"$tmp" 2>&1 &
  local pid=$!
  "$GUM" spin --spinner dot --title " $title …" -- bash -c "while kill -0 $pid 2>/dev/null; do sleep 0.15; done" || true
  wait "$pid" || rc=$?
  out="$(cat "$tmp")"; rm -f "$tmp"
  [[ -n "$out" ]] || out="(no output)"
  local color="$C_OK" mark="✓"; (( rc == 0 )) || { color="$C_BAD"; mark="✗ exit $rc"; }
  local lines; lines="$(wc -l <<<"$out")"
  if (( lines > ${LINES:-30} - 12 )); then
    printf '%s\n' "$out" | "$GUM" pager --border-foreground "$C_VIOLET2" || true
  else
    ui_header
    printf '  %s %s\n' "$(g_style --foreground "$color" --bold "$mark")" "$(g_style --foreground "$C_TEXT" --bold "$title")"
    g_style --border rounded --border-foreground "$color" --foreground "$C_TEXT" --padding "0 1" --margin "0 1" "$out"
    g_wait
  fi
  return "$rc"
}
ui_shell() {
  [[ "$UI" == gum ]] || { legacy_ui_shell "$@"; return; }
  local title="$1"; shift
  ui_header
  printf '  %s %s\n\n' "$(g_style --foreground "$C_CYAN" "⇄")" "$(g_style --foreground "$C_TEXT" --bold "$title")"
  local rc=0; ( "$@" ) || rc=$?
  echo; printf '  %s ' "$(g_style --foreground "$C_DIM" "[exit $rc] ↵ back to menu")"; read -rs _ </dev/tty; echo
  return "$rc"
}
ui_danger() {
  [[ "$UI" == gum ]] || { legacy_ui_danger "$@"; return; }
  ui_header
  printf '  %s\n' "$(g_style --foreground "$C_BAD" --bold "▲ DANGER ZONE")"
  g_box "$C_BAD" "$1"
  local a; a="$("$GUM" input --prompt "  type YES ❯ " --prompt.foreground "$C_BAD" --placeholder "YES" --width 40)" || return 1
  [[ "$a" == YES ]]
}

# ---------------------------------------------------------------- legacy backends (whiptail / dialog / plain)
legacy_ui_danger() { # text -> 0 only if the user types YES
  case "$UI" in
    plain) local a; printf '\n!!! DANGER !!!\n%b\nType YES to continue: ' "$1"; read -r a </dev/tty; [[ "$a" == YES ]] ;;
    *) local a
       a="$(NEWT_COLORS='root=,red window=,red border=white,red textbox=white,red button=black,white' DIALOGRC='' \
         "$UI" --title "DANGER: $UI_TITLE" --inputbox "$1\n\nType YES to continue:" "$UI_H" "$UI_W" "" 3>&1 1>&2 2>&3)" || return 1
       [[ "$a" == YES ]] ;;
  esac
}

legacy_ui_msg() { # text
  case "$UI" in
    plain) printf '\n%b\n\n' "$1"; read -r -p "[Enter] " _ </dev/tty ;;
    *) "$UI" --title "$UI_TITLE" --msgbox "$1" "$UI_H" "$UI_W" ;;
  esac
}

legacy_ui_yesno() { # text -> 0 yes / 1 no
  case "$UI" in
    plain) local a; printf '%b [y/N] ' "$1"; read -r a </dev/tty; [[ "$a" =~ ^[Yy] ]] ;;
    *) "$UI" --title "$UI_TITLE" --yesno "$1" "$UI_H" "$UI_W" ;;
  esac
}

legacy_ui_input() { # text default -> stdout value; status 1 on cancel
  case "$UI" in
    plain) local a; read -r -p "$1 [$2]: " a </dev/tty || return 1; echo "${a:-$2}" ;;
    *) "$UI" --title "$UI_TITLE" --inputbox "$1" 10 "$UI_W" "$2" 3>&1 1>&2 2>&3 ;;
  esac
}

legacy_ui_menu() { # text, then "tag|label" items -> stdout tag; status 1 on cancel/back
  local text="$1"; shift
  local -a args=() tags=()
  local it
  for it in "$@"; do args+=("${it%%|*}" "${it#*|}"); tags+=("${it%%|*}"); done
  case "$UI" in
    plain)
      printf '\n== %s ==\n%b\n' "$UI_TITLE" "$text" >&2
      local i=1
      for it in "$@"; do printf '  %2d) %s\n' "$i" "${it#*|}" >&2; i=$((i+1)); done
      printf '   0) Back / quit\n' >&2
      local n; read -r -p "> " n </dev/tty || return 1
      [[ "$n" =~ ^[0-9]+$ ]] && (( n >= 1 && n <= ${#tags[@]} )) || return 1
      echo "${tags[$((n-1))]}" ;;
    *) "$UI" --title "$UI_TITLE" --menu "$text" "$UI_H" "$UI_W" 12 "${args[@]}" 3>&1 1>&2 2>&3 ;;
  esac
}

# Run a non-interactive command, capture output, show it in a box.
legacy_ui_run() { # title, command...
  local title="$1"; shift
  local out rc=0
  out="$( ( "$@" ) 2>&1 )" || rc=$?
  [[ -n "$out" ]] || out="(no output)"
  (( rc == 0 )) || out="$out"$'\n\n'"[exit $rc]"
  case "$UI" in
    plain) printf '\n--- %s ---\n%s\n' "$title" "$out"; read -r -p "[Enter] " _ </dev/tty ;;
    *) "$UI" --title "$UI_TITLE: $title" --scrolltext --msgbox "$out" "$UI_H" "$UI_W" 2>/dev/null \
         || "$UI" --title "$UI_TITLE: $title" --msgbox "$out" "$UI_H" "$UI_W" ;;
  esac
  return "$rc"
}

# Run an interactive command on the plain terminal (login, logs -f, editor).
legacy_ui_shell() { # title, command...
  local title="$1"; shift
  clear 2>/dev/null || true
  echo "== $title =="
  local rc=0; ( "$@" ) || rc=$?
  echo; read -r -p "[exit $rc] Press Enter to return to the menu " _ </dev/tty
  return "$rc"
}

ui_root_or_msg() {
  [[ $EUID -eq 0 ]] && return 0
  ui_msg "This needs root. Quit and run: sudo grokbot-relay"
  return 1
}

# ---------------------------------------------------------------- menu loop
# Registry entries: "id|label|function". Add a feature = add one line.
ui_loop() { # text, array-name
  local text="$1"; local -n reg="$2"
  local -a items=(); local e
  for e in "${reg[@]}"; do IFS='|' read -r id label _ <<<"$e"; items+=("$id|$label"); done
  while true; do
    local pick; pick="$(ui_menu "$text" "${items[@]}")" || return 0
    for e in "${reg[@]}"; do
      IFS='|' read -r id _ fn <<<"$e"
      if [[ "$id" == "$pick" ]]; then
        [[ "$fn" == back ]] && return 0
        "$fn" || true
      fi
    done
  done
}

# ---------------------------------------------------------------- actions
t_status()   { ui_run "status" cmd_status; }
t_start()    { ui_root_or_msg && ui_run "start" cmd_svc start; }
t_stop()     { ui_root_or_msg && ui_run "stop" cmd_svc stop; }
t_restart()  { ui_root_or_msg && ui_run "restart" cmd_svc restart; }
t_logs()     { ui_run "logs (last 100)" cmd_logs; }
t_logs_f()   { ui_shell "logs -f (Ctrl+C to stop)" cmd_logs -f; }
t_login()    { ui_root_or_msg || return 1
  ui_msg "Cursor sign-in as the grokbot user.\n\nA sign-in link will be printed. Open it in any browser (another computer is fine), finish signing in, and the command returns."
  ui_shell "bdk login" cmd_login; }
t_update()   { ui_root_or_msg && ui_yesno "Pull the source clone, recopy, npm ci and restart?\nenv and agents.json are kept." && ui_run "update" cmd_update; }
t_node_up()  { ui_root_or_msg && ui_yesno "Refresh the private Node runtime to the latest $NODE_MAJOR.x?\nSHA256-checked; rolls back if validation fails." && ui_run "node-upgrade" cmd_node_upgrade; }
t_bdk_check(){ ui_run "bdk-check" cmd_bdk_check; }
t_bdk_up()   { ui_root_or_msg && ui_yesno "Upgrade @cursor/bdk to the latest version?\nIt is validated first; on failure it rolls back." && ui_run "bdk-upgrade" cmd_bdk_upgrade; }
t_doctor()   { ui_run "doctor" cmd_doctor; }
t_connect()  { ui_msg "Regular users connect Claude Code like this:\n\n  1) Admin: sudo usermod -aG grokbot <user>\n  2) User logs out and back in\n  3) User runs: grokbot-relay connect-claude\n  4) claude plugin marketplace add devicki/dev-toolkit\n     claude plugin install grokbot-relay@dev-toolkit\n\nThe token is read from /etc/grokbot-relay/env at each start; it is not stored in Claude Code's config."; }
t_uninstall() {
  ui_root_or_msg || return 1
  local mode
  mode="$(ui_menu "Uninstall grokbot-relay. The source clone is never touched." \
    "ask|Remove service and app; ask about config, login, user" \
    "keep|Remove service and app; keep config (token, agents.json)" \
    "purge|Remove EVERYTHING (config, Cursor login, grokbot user)")" || return 0
  ui_danger "This stops the relay and removes $UNIT, $APP_DIR and /usr/local/bin/grokbot-relay.\nMode: $mode" || { ui_msg "Cancelled."; return 0; }
  case "$mode" in
    ask)   ui_shell "uninstall" cmd_uninstall -y ;;
    keep)  ui_shell "uninstall" cmd_uninstall -y --keep-config ;;
    purge) ui_shell "uninstall" cmd_uninstall -y --purge ;;
  esac
  clear 2>/dev/null || true
  echo "grokbot-relay was uninstalled. Exiting the menu."
  exit 0
}
t_about()    { ui_msg "grokbot-relay $(read_version "$(script_root)")\n@cursor/bdk $(installed_bdk)\n\nhttps://github.com/devicki/grokbot-relay\nCLI help: grokbot-relay help"; }

t_agents_list() { ui_run "agents" cmd_agents list; }
t_agents_add() {
  ui_root_or_msg || return 1
  local n; n="$(ui_input "Bot name, exactly as shown in the Grok Bot app:" "")" || return 0
  [[ -n "$n" ]] || return 0
  ui_run "agents add" cmd_agents add "$n"
}
t_agents_remove() {
  ui_root_or_msg || return 1
  local -a items=(); local n
  while IFS= read -r n; do [[ -n "$n" && "$n" != "("* ]] && items+=("$n|$n"); done < <(agents_js list 2>/dev/null)
  (( ${#items[@]} )) || { ui_msg "No agents listed."; return 0; }
  n="$(ui_menu "Remove which bot? (the last one cannot be removed)" "${items[@]}")" || return 0
  ui_run "agents remove" cmd_agents remove "$n"
}
t_agents_edit() { ui_root_or_msg && ui_shell "agents edit" cmd_agents edit; }

AGENTS_MENU=(
  "list|List allowed bots|t_agents_list"
  "add|Add a bot|t_agents_add"
  "remove|Remove a bot|t_agents_remove"
  "edit|Edit agents.json in \$EDITOR|t_agents_edit"
  "back|Back|back"
)
t_agents() { ui_loop "Bot allowlist ($AGENTS_FILE)" AGENTS_MENU; }

SERVICE_MENU=(
  "start|Start|t_start"
  "stop|Stop|t_stop"
  "restart|Restart|t_restart"
  "logs|Recent logs|t_logs"
  "follow|Follow logs (-f)|t_logs_f"
  "back|Back|back"
)
t_service() { ui_loop "Service control" SERVICE_MENU; }

BDK_MENU=(
  "check|Check for a newer @cursor/bdk|t_bdk_check"
  "upgrade|Upgrade @cursor/bdk (validate, rollback on failure)|t_bdk_up"
  "node|Refresh private Node runtime (latest 24.x)|t_node_up"
  "back|Back|back"
)
t_bdk() { ui_loop "Cursor BDK and Node runtime" BDK_MENU; }

MAIN_MENU=(
  "status|◉  Status|t_status"
  "service|⏻  Start · stop · restart · logs|t_service"
  "agents|⇄  Bots (allowlist)|t_agents"
  "login|⚿  Cursor login|t_login"
  "doctor|✚  Doctor|t_doctor"
  "update|↻  Update grokbot-relay|t_update"
  "bdk|⬢  Cursor BDK · Node runtime|t_bdk"
  "wizard|✦  Setup wizard|tui_wizard"
  "connect|⌁  Connect Claude Code|t_connect"
  "about|ⓘ  About|t_about"
  "uninstall|▲  Uninstall|t_uninstall"
  "quit|⏏  Quit|back"
)

# ---------------------------------------------------------------- wizard
w_welcome() {
  ui_yesno "Welcome to grokbot-relay $(read_version "$(script_root)").\n\nThis wizard will:\n  - choose the Node runtime (private by default)\n  - install the service (user, /opt app, env, systemd)\n  - set your bot names\n  - sign in to Cursor\n  - start the relay and run checks\n  - let regular users connect\n\nContinue?"
}
W_NODE_MODE=private
w_node() {
  local sys; sys="$(PATH=/usr/local/bin:/usr/bin:/bin command -v node || true)"
  if [[ -n "$sys" ]]; then
    local pick
    pick="$(ui_menu "Node runtime for the relay.\nA system node was found: $sys ($("$sys" -v))." \
      "private|Private Node $NODE_MAJOR (recommended; in $NODE_DIR, not on global PATH)" \
      "system|Use the system node (needs 22+)")" || return 1
    W_NODE_MODE="$pick"
  else
    W_NODE_MODE=private
    ui_msg "The relay will use a private Node $NODE_MAJOR runtime in $NODE_DIR.\nIt is downloaded from nodejs.org, SHA256-checked, and never added to the global PATH, so other accounts' Node (nvm etc.) is unaffected.\n\nNeeds: curl, tar, sha256sum."
  fi
}
w_install() {
  local port=3000 cur
  if [[ -r "$ENV_FILE" ]]; then cur="$(env_value GROKBOT_RELAY_PORT)"; port="${cur:-3000}"; fi
  if [[ -f "$ENV_FILE" ]]; then
    ui_msg "Existing config found (port $port). It will be kept."
  else
    port="$(ui_input "Port for the relay (listens on 127.0.0.1 only):" "$port")" || return 1
    [[ "$port" =~ ^[0-9]+$ ]] || { ui_msg "Invalid port."; return 1; }
  fi
  ui_run "Installing (Node runtime, npm ci, service)" cmd_install --port "$port" --node "$W_NODE_MODE"
  local rc=$?; ui_detect; return "$rc"
}
w_agents() {
  while true; do
    local list; list="$(agents_js list 2>/dev/null || true)"
    local pick
    pick="$(ui_menu "Allowed bots now:\n$list\n\nAdd your bots exactly as named in the Grok Bot app, then remove the example 'Research Bot'. The list can never be empty." \
      "add|Add a bot" "remove|Remove a bot" "done|Done")" || pick="done"
    case "$pick" in
      add) t_agents_add || true ;;
      remove) t_agents_remove || true ;;
      done)
        if grep -qx "Research Bot" <<<"$list" && ! ui_yesno "The example 'Research Bot' is still listed. Continue anyway?"; then continue; fi
        return 0 ;;
    esac
  done
}
w_login()  { ui_yesno "Sign in to Cursor now? (needed before the relay can reach your bots)" && t_login; return 0; }
w_start()  { ui_yesno "Start the relay now?" && ui_run "start" cmd_svc start; return 0; }
w_doctor() { ui_run "doctor" cmd_doctor; return 0; }
w_users() {
  while ui_yesno "Add a regular user to the grokbot group (so they can connect Claude Code)?"; do
    local u; u="$(ui_input "Username:" "")" || break
    [[ -n "$u" ]] || break
    if id "$u" >/dev/null 2>&1; then ui_run "usermod" usermod -aG "$SVC_USER" "$u"; else ui_msg "No such user: $u"; fi
  done
  t_connect
}

# Wizard steps: "id|label|function". Add a step = add one line.
WIZARD_STEPS=(
  "welcome|Welcome|w_welcome"
  "node|Node runtime|w_node"
  "install|Install service|w_install"
  "agents|Bot names|w_agents"
  "login|⚿  Cursor login|w_login"
  "start|Start|w_start"
  "doctor|Doctor|w_doctor"
  "users|Group users|w_users"
)

tui_wizard() {
  ui_root_or_msg || return 1
  local e id label fn i=0 total=${#WIZARD_STEPS[@]}
  for e in "${WIZARD_STEPS[@]}"; do
    IFS='|' read -r id label fn <<<"$e"
    i=$((i+1)); UI_STEP="$i/$total $label"
    UI_TITLE="grokbot-relay setup [$i/$total] $label"
    if ! "$fn"; then UI_STEP=""; UI_TITLE="grokbot-relay"; ui_msg "Setup stopped at: $label.\nRun it again any time: sudo grokbot-relay install --tui"; return 1; fi
  done
  UI_STEP=""; UI_TITLE="grokbot-relay"
  ui_msg "Setup finished. Open the menu any time with: sudo grokbot-relay"
}

tui_main() {
  [[ -t 0 && -t 1 ]] || die "The TUI needs a terminal. See: grokbot-relay help"
  if [[ ! -d "$RELAY_DIR/node_modules" ]] && [[ $EUID -eq 0 ]]; then
    ui_yesno "grokbot-relay is not installed yet. Run the setup wizard?" && tui_wizard
  fi
  ui_loop "Choose an action" MAIN_MENU
  clear 2>/dev/null || true
}
