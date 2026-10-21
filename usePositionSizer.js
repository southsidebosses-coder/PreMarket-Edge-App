import { useState, useMemo } from 'react';

export const usePositionSizer = (initialBalance = '10000', initialRiskPct = '1.5') => {
  const [accountBalance, setAccountBalance] = useState(initialBalance);
  const [riskPercentage, setRiskPercentage] = useState(initialRiskPct);
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLossPrice, setStopLossPrice] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [optionDelta, setOptionDelta] = useState('0.50');

  const metrics = useMemo(() => {
    const balance = parseFloat(accountBalance) || 0;
    const riskPct = parseFloat(riskPercentage) || 0;
    const entry = parseFloat(entryPrice) || 0;
    const stop = parseFloat(stopLossPrice) || 0;
    const target = parseFloat(targetPrice) || 0;
    const delta = Math.min(Math.max(parseFloat(optionDelta) || 0.5, 0.05), 1.0);

    if (balance <= 0 || riskPct <= 0 || entry <= 0 || stop <= 0 || entry === stop) {
      return {
        isValid: false,
        dollarRisk: 0,
        riskPerShare: 0,
        maxShares: 0,
        totalCapital: 0,
        portfolioAllocationPct: 0,
        riskRewardRatio: 0,
        isLong: true,
        asymmetryRating: 'INVALID',
        optionsContracts: 0,
        maxDollarLoss: 0,
        isOverAllocated: false,
      };
    }

    const isLong = entry > stop;
    const riskPerShare = Math.abs(entry - stop);
    const dollarRisk = balance * (riskPct / 100);
    const maxShares = Math.floor(dollarRisk / riskPerShare);
    const totalCapital = maxShares * entry;
    const portfolioAllocationPct = (totalCapital / balance) * 100;
    const maxDollarLoss = maxShares * riskPerShare;

    let riskRewardRatio = 0;
    let asymmetryRating = 'INVALID';

    if (target > 0) {
      const rewardPerShare = isLong ? target - entry : entry - target;
      if (rewardPerShare > 0) {
        riskRewardRatio = parseFloat((rewardPerShare / riskPerShare).toFixed(2));
        if (riskRewardRatio >= 2.5) {
          asymmetryRating = 'EXCELLENT';
        } else if (riskRewardRatio >= 1.5) {
          asymmetryRating = 'ACCEPTABLE';
        } else {
          asymmetryRating = 'REJECTED';
        }
      } else {
        asymmetryRating = 'NEGATIVE_REWARD';
      }
    }

    const sharesPerContract = 100 * delta;
    const rawContracts = Math.floor(maxShares / sharesPerContract);
    const optionsContracts = Math.max(rawContracts, rawContracts === 0 && maxShares > 0 ? 1 : 0);

    // Risk-enforcement firewall: a setup whose capital outlay exceeds the
    // account balance is not fundable — REJECTED regardless of how good
    // the R:R looks (over-leverage must never be dressed up as asymmetry).
    const isOverAllocated = totalCapital > balance;
    if (isOverAllocated) {
      asymmetryRating = 'REJECTED';
    }

    return {
      isValid: true,
      isLong,
      isOverAllocated,
      dollarRisk: parseFloat(dollarRisk.toFixed(2)),
      riskPerShare: parseFloat(riskPerShare.toFixed(2)),
      maxShares,
      totalCapital: parseFloat(totalCapital.toFixed(2)),
      portfolioAllocationPct: parseFloat(portfolioAllocationPct.toFixed(1)),
      maxDollarLoss: parseFloat(maxDollarLoss.toFixed(2)),
      riskRewardRatio,
      asymmetryRating,
      optionsContracts,
    };
  }, [accountBalance, riskPercentage, entryPrice, stopLossPrice, targetPrice, optionDelta]);

  return {
    inputs: { accountBalance, riskPercentage, entryPrice, stopLossPrice, targetPrice, optionDelta },
    setters: { setAccountBalance, setRiskPercentage, setEntryPrice, setStopLossPrice, setTargetPrice, setOptionDelta },
    metrics,
  };
};
