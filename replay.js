const stages = [
  {
    title: "Ready to begin",
    detail: "The wallet owner buys coverage before the agent records an incident.",
    action: "Buy demo policy",
  },
  {
    title: "Policy active",
    detail: "The owner pays a 0.01 NEAR premium and the vault reserves up to 0.40 NEAR for the policy.",
    action: "Record simulated loss",
  },
  {
    title: "0.30 NEAR loss recorded",
    detail: "The runner records a simulated loss. The on-chain demo used a testnet transfer to create the evidence.",
    action: "Submit and review claim",
  },
  {
    title: "Claim approved",
    detail: "The runner submits the wallet record. Two of three reviewers approve 0.25 NEAR after applying the 0.05 NEAR deductible.",
    action: "Release demo payout",
  },
  {
    title: "0.25 NEAR reimbursed",
    detail: "The claim replay is complete. In the recorded testnet transaction, the vault paid the recovery account and its balance rose from 0.03 to 0.28 NEAR.",
    action: "Replay complete",
  },
];

const title = document.querySelector("#stage-title");
const detail = document.querySelector("#stage-detail");
const advance = document.querySelector("#advance");
const reset = document.querySelector("#reset");
const steps = [...document.querySelectorAll("#timeline li")];
let stage = 0;

function render() {
  const current = stages[stage];
  title.textContent = current.title;
  detail.textContent = current.detail;
  advance.textContent = current.action;
  advance.disabled = stage === stages.length - 1;
  reset.disabled = stage === 0;
  steps.forEach((step, index) => {
    step.classList.toggle("done", index < stage);
    if (index === stage - 1) step.setAttribute("aria-current", "step");
    else step.removeAttribute("aria-current");
  });
}

advance.addEventListener("click", () => {
  if (stage === stages.length - 1) return;
  stage++;
  render();
  if (advance.disabled) reset.focus();
});

reset.addEventListener("click", () => {
  stage = 0;
  render();
  advance.focus();
});

document.querySelector(".controls").hidden = false;
