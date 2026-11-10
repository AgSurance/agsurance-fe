const stages = [
  {
    title: "Ready to begin",
    detail: "Two wallet owners buy coverage backed by the same reserve.",
    action: "Activate demo coverage",
  },
  {
    title: "Two policies active",
    detail: "The shared reserve locks 0.40 NEAR per policy. Only 0.20 NEAR is free, so the third checkout is refunded in full.",
    action: "Record simulated loss",
  },
  {
    title: "0.30 NEAR loss recorded",
    detail: "A testnet transfer creates a receipt the panel can check against the wallet's spending mandate.",
    action: "Review the claim",
  },
  {
    title: "Claim approved · payout on hold",
    detail: "Two reviewers approve 0.25 NEAR after the deductible. The test scenario simulates a 0.40 NEAR reserve shortfall, so the claim remains approved and its allocation stays locked.",
    action: "Restore the reserve",
  },
  {
    title: "Reserve fully backed",
    detail: "A 0.40 NEAR testnet top-up backs both policies again. The approved claim is ready to pay.",
    action: "Replay reimbursement",
  },
  {
    title: "0.25 NEAR reimbursed",
    detail: "In the recorded testnet transaction, the shared reserve sent 0.25 NEAR to this policy's recovery account. The second policy received its own 0.25 NEAR payout after a retry.",
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
