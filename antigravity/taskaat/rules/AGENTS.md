# Taskaat Agent Directives

When working in a workspace integrated with Taskaat:

1. **Session Orientation**: Call `__init_tasker_session` at the beginning of a session to load project preferences and active instructions.
2. **Attention First**: Check `get_my_attention` to review pending human reviews, unconsumed guidance, blocked agent sessions, or high-priority overdue work before picking up new tasks.
3. **Execution Continuity**: For complex, multi-step features or refactors, use `get_flow_context` / `run_flow` rather than executing tasks ad hoc.
4. **Gates & Contracts**: Respect output contracts. Store artifacts with `store_artifact` and run verification before marking tasks complete.
