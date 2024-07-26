import 'cypress-if';

const networks = {
  Linea: '59144', // $1000+ weekly
  Scroll: '534352', // $1000+ weekly
  zkSync: '324', // $5000+ weekly
  // TODO: ..
  // Mantle: '5000',
  // Mode: '34443',
};

const defaultNetwork = 'Linea';

const elements = {
  common: {
    p: 'p',
    body: 'body',
    input: 'input',
  },
  removeLiquidityPopup: {
    doNotShowAgain: ['p', 'do not show again'],
    closeIcon: ['div:nth-child(4)>div:nth-child(1)>img:nth-child(2)'],
  },
  connectWallet: {
    connect: ['button', 'Connect Wallet'],
    metamastk: ['Metamask', { selector: 'p', trim: true }],
  },
  swap: {
    input: ['have.class', 'chakra-input'],
    approveButton: ['button', `Approve [TOKEN]`],
    continueButton: ['button', 'Continue'],
    priceImpact: ['p', 'Price Impact'],
    swapButton: ['div:nth-child(5)>div:nth-child(2)>button:nth-child(1)'],
    swapButtonPopup: [
      'div:nth-child(3)>div:nth-child(2)>div:nth-child(1)>button:nth-child(2)',
    ],
    swapButtonPopupFallback: [
      'div:nth-child(3)>div:nth-child(2)>div:nth-child(1)>button:nth-child(3)',
    ],
    success: ['img[src="/assets/loading/success.svg"]'],
  },
  selectPairToSwap: {
    input: ['Enter name or paste address'],
    to: [
      'div:nth-child(3)>div:nth-child(1)>div:nth-child(1)>div:nth-child(1)>div:nth-child(1)>img:nth-child(2)',
    ],
    from: [
      'div:nth-child(1)>div:nth-child(1)>div:nth-child(1)>div:nth-child(1)>div:nth-child(1)>img:nth-child(2)',
    ],
  },
};

// https://docs.etherscan.io/api-endpoints/accounts
describe('IZUMI swaps', () => {
  const PAIR = Cypress.env('PAIR');
  if (!PAIR) throw new Error('PAIR is required');

  let USD = Cypress.env('USD');
  if (!USD) throw new Error('USD is required');
  USD = parseFloat(Cypress.env('USD'));

  let NETWORK_NAME = Cypress.env('NETWORK_NAME');
  if (!NETWORK_NAME) throw new Error('NETWORK_NAME is required');

  let WRAP_UNWRAP_CYCLES = Cypress.env('WRAP_UNWRAP_CYCLES');
  if (!WRAP_UNWRAP_CYCLES) throw new Error('WRAP_UNWRAP_CYCLES is required');
  WRAP_UNWRAP_CYCLES = parseInt(WRAP_UNWRAP_CYCLES, 10);

  let MAX_SLIPPAGE_TOLERANCE = Cypress.env('MAX_SLIPPAGE_TOLERANCE');
  if (!MAX_SLIPPAGE_TOLERANCE) throw new Error('MAX_SLIPPAGE_TOLERANCE is required');
  MAX_SLIPPAGE_TOLERANCE = parseFloat(MAX_SLIPPAGE_TOLERANCE);

  before(() => {
    cy.visit(`https://izumi.finance/trade/swap`);
    cy.acceptMetamaskAccess();
  });

  it(`Cooking ..`, () => {
    connectMetamask();
    switchToNetwork(NETWORK_NAME);

    const [fromSymbol, toSymbol] = PAIR.split('/');

    cy.task('warn', `MAX_SLIPPAGE_TOLERANCE: ${MAX_SLIPPAGE_TOLERANCE}%`);

    let i = 0;
    while (true) {
      if (i === WRAP_UNWRAP_CYCLES) {
        cy.task('warn', `\nIZUMI ${NETWORK_NAME}: COMPLETED!`);
        break;
      }

      cy.task('warn', `Cycle ${i + 1} of ${WRAP_UNWRAP_CYCLES} begins ..`);

      closeRemoveLiquidityPopup();
      selectPairToSwap({ from: fromSymbol, to: toSymbol });
      swap({ to: toSymbol, from: fromSymbol, amount: USD * 0.996 });
      cy.wait(getRandomInt(20000, 45000));

      selectPairToSwap({ from: toSymbol, to: fromSymbol });
      swap({ to: fromSymbol, from: toSymbol, amount: USD * 0.994 });
      cy.wait(getRandomInt(60000, 120000));

      cy.task('warn', `Cycle ${i + 1} of ${WRAP_UNWRAP_CYCLES} ended ..`);
      i++;
    }
  });

  function closeRemoveLiquidityPopup() {
    cy.wait(getRandomInt(400, 800))
      .contains(...elements.removeLiquidityPopup.doNotShowAgain)
      .if()
      .click()
      .wait(getRandomInt(400, 800))
      .get(...elements.removeLiquidityPopup.closeIcon)
      .if()
      .click();
  }

  function switchToNetwork(network) {
    cy.task('warn', `Switching network to ${network} ..`);
    cy.visit(`https://izumi.finance/trade/swap?chainId=${networks[network]}`);
    if (network === defaultNetwork) {
      cy.changeMetamaskNetwork(network);
    } else {
      cy.allowMetamaskToAddAndSwitchNetwork(network);
    }
  }

  function connectMetamask() {
    cy.contains(...elements.connectWallet.connect)
      .if()
      .click()
      .then(() => {
        cy.findByText(...elements.connectWallet.metamastk)
          .if()
          .click();
      });
  }

  function swap(args) {
    cy.task('warn', `Swapping ${args.from}/${args.to} for ~${args.amount} USD`);

    cy.get(elements.common.input)
      .should(...elements.swap.input)
      .first()
      .type(parseFloat(args.amount).toFixed(2))
      .blur()
      .wait(getRandomInt(400, 800))
      .get(elements.common.body)
      .wait(getRandomInt(400, 800))
      .click();

    cy.contains(...elements.swap.approveButton.map(e => e.replace('[TOKEN]', args.from)))
      .if()
      .click()
      .then(() => {
        cy.wait(getRandomInt(15000, 30000))
          .switchToMetamaskNotification()
          .confirmMetamaskPermissionToSpend({
            spendLimit: `${args.amount}`,
          })
          .then(spent => {
            expect(spent).to.be.true;
          })
          .wait(getRandomInt(15000, 30000));
      });

    cy.contains(...elements.swap.continueButton)
      .if()
      .click();

    cy.contains(...elements.swap.priceImpact)
      .next()
      .then($el => {
        const priceImpact = parseFloat($el.get(0).innerText.replace('%', ''));
        cy.task('warn', `Price impact: ${priceImpact}%`);
        return cy.wrap(priceImpact);
      })
      .then(priceImpact => {
        expect(priceImpact).to.be.lte(MAX_SLIPPAGE_TOLERANCE);
      });

    cy.get(...elements.swap.swapButton).click();
    cy.get(...elements.swap.swapButtonPopup)
      .if()
      .click()
      .else()
      .then(() => {
        cy.get(...elements.swap.swapButtonPopupFallback)
          .if()
          .click();
      });

    cy.task(
      'confirmMetamaskTransaction',
      { gasConfig: 'aggressive' },
      { timeout: 90000 },
    ).then(txData => {
      expect(txData.confirmed).to.be.true;
    });
    cy.switchToCypressWindow();

    cy.get(...elements.swap.success, { timeout: 90000 }).should('exist');
    cy.task('warn', `Succesfully swapped!`);
    cy.reload();
  }

  function selectPairToSwap(args) {
    cy.task('warn', `Selecting pair to swap ${args.from}/${args.to} ..`);

    cy.get(...elements.selectPairToSwap.to).click();
    cy.findByPlaceholderText(elements.selectPairToSwap.input)
      .first()
      .type(args.to)
      .wait(getRandomInt(200, 400))
      .blur()
      .wait(getRandomInt(300, 600))
      .get(elements.common.body)
      .wait(getRandomInt(300, 600));
    cy.get(elements.common.p).contains(args.to).first().click();

    cy.get(...elements.selectPairToSwap.from).click();
    cy.findByPlaceholderText(elements.selectPairToSwap.input)
      .first()
      .type(args.from)
      .wait(getRandomInt(200, 400))
      .blur()
      .wait(getRandomInt(300, 600))
      .get(elements.common.body)
      .wait(getRandomInt(300, 600));
    cy.get(elements.common.p).contains(args.from).first().click();
  }

  function getRandomInt(min, max) {
    return Math.floor(min + Math.random() * (max + 1 - min));
  }
});
