import { historicalPayoutHash, receiptUrl } from "../../lib/demo-links";

const increaseHash = "CL3ko61db2p4Mw2tZaLEaj9hPWLaXZpW3tipt7CyrkNV";

export function HistoricalLimit() {
  return (
    <section className="demo-panel demo-run" id="historical-limit" tabIndex={-1} aria-labelledby="historical-limit-heading">
      <h2 id="historical-limit-heading">Why the second claim paid 0.18 NEAR</h2>
      <p>In this separate testnet run, the policy limit rose before the claim was filed. The payout used the limit in force at the block where the loss occurred.</p>
      <ol className="demo-run-trail" role="list">
        <li>
          <div><strong>0.18 NEAR limit at the simulated loss</strong><p className="demo-description">A simulated transfer of 0.30 NEAR executed in block 277,218,273.</p></div>
          <div className="demo-run-links">
            <a className="demo-proof" href={receiptUrl("8fTSvqtdGgnu8oSRwoVD9VvESmmonPuQ8PAqz64ZHEco")}>Original checkout</a>
            <a className="demo-proof" href={receiptUrl("BymqcFtbnvv1By82NaRvmUegQsc9p5DdZDdtB4z8jDAJ")}>Loss transfer receipt</a>
            <a className="demo-proof" href="https://testnet.nearblocks.io/blocks/277218273">Loss block</a>
          </div>
        </li>
        <li>
          <div><strong>New limit of 0.42 NEAR</strong><p className="demo-description">The reserve booked the additional capacity. The vault confirmed the increase in block 277,218,292, effective from block 277,218,293.</p></div>
          <div className="demo-run-links">
            <a className="demo-proof" href={receiptUrl(increaseHash)}>Limit increase receipts</a>
            <a className="demo-proof" href={`https://testnet.nearblocks.io/txns/${increaseHash}/execution#2muG7K5oEDzrQ9SuJSCUj9Kh2RjH7tP2yemzG2tUHpsw`}>Confirmation in block 277,218,292</a>
            <a className="demo-proof" href="https://testnet.nearblocks.io/blocks/277218293">Effective block</a>
          </div>
        </li>
        <li>
          <div><strong>0.18 NEAR paid after the increase</strong><p className="demo-description">The agent filed after the increase. Two reviewers approved the earlier receipt, and the reserve paid the limit that applied to that transfer.</p></div>
          <div className="demo-run-links">
            <a className="demo-proof" href={receiptUrl("J4nvLf47vmy5rfwf2aB1nU2TYXeQ68cK5d5qEGyuqeD6")}>Claim filing</a>
            <a className="demo-proof" href={receiptUrl("AixCayE4YVQJmZHGyg66rgNLEf65574qabX2bYZE8HrK")}>Reviewer 1</a>
            <a className="demo-proof" href={receiptUrl("8X9joNTVEjpzZs5Vnc3XNb4g7umoEKPBFmu3gPeQGs5t")}>Reviewer 2</a>
            <a className="demo-proof" href={receiptUrl(historicalPayoutHash)}>0.18 NEAR payout receipt</a>
          </div>
        </li>
      </ol>
    </section>
  );
}
