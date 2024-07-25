import 'cypress-if';

const networks = {
  Linea: '59144',
  Scroll: '534352',
  zkSync: '324',
  // TODO: ..
  // Mantle: '5000',
  // Mode: '34443',
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
      swap({
        to: toSymbol,
        from: fromSymbol,
        amount: USD * 0.996,
      });
      cy.wait(getRandomInt(20000, 45000));

      selectPairToSwap({ from: toSymbol, to: fromSymbol });
      swap({
        to: fromSymbol,
        from: toSymbol,
        amount: USD * 0.994,
      });
      cy.wait(getRandomInt(60000, 120000));

      cy.task('warn', `Cycle ${i + 1} of ${WRAP_UNWRAP_CYCLES} ended ..`);
      i++;
    }
  });

  function closeRemoveLiquidityPopup() {
    cy.wait(getRandomInt(400, 800));
    cy.contains('p', 'do not show again').if().click();
    cy.wait(getRandomInt(400, 800));
    cy.get('div:nth-child(4)>div:nth-child(1)>img:nth-child(2)').if().click();
  }

  function switchToNetwork(network) {
    cy.task('warn', `Switching network to ${network} ..`);
    cy.visit(`https://izumi.finance/trade/swap?chainId=${networks[network]}`);
    if (network === 'Linea') {
      cy.changeMetamaskNetwork(network);
    } else {
      cy.allowMetamaskToAddAndSwitchNetwork(network);
    }
  }

  function connectMetamask() {
    cy.contains('button', 'Connect Wallet')
      .if()
      .click()
      .then(() => {
        cy.findByText('Metamask', { selector: 'p', trim: true }).if().click();
      });
  }

  function swap(args) {
    cy.task('warn', `Swapping ${args.from}/${args.to} for ~${args.amount} USD`);

    cy.get('input')
      .should('have.class', 'chakra-input')
      .first()
      .type(parseFloat(args.amount).toFixed(2))
      .blur()
      .wait(getRandomInt(400, 800))
      .get('body')
      .wait(getRandomInt(400, 800))
      .click();

    cy.contains('button', `Approve ${args.from}`)
      .if()
      .click()
      .then(() => {
        cy.wait(getRandomInt(15000, 30000));
        cy.switchToMetamaskNotification();
        cy.confirmMetamaskPermissionToSpend({
          spendLimit: `${args.amount}`,
        }).then(spent => {
          expect(spent).to.be.true;
        });
        cy.wait(getRandomInt(15000, 30000));
      });

    cy.contains('button', 'Continue').if().click();

    cy.contains('p', 'Price Impact')
      .next()
      .then($el => {
        const priceImpact = parseFloat($el.get(0).innerText.replace('%', ''));
        cy.task('warn', `Price impact: ${priceImpact}%`);
        return cy.wrap(priceImpact);
      })
      .then(priceImpact => {
        expect(priceImpact).to.be.lte(MAX_SLIPPAGE_TOLERANCE);
      });

    // Swap buttons
    cy.get('div:nth-child(5)>div:nth-child(2)>button:nth-child(1)').click();

    cy.get('div:nth-child(3)>div:nth-child(2)>div:nth-child(1)>button:nth-child(2)')
      .if()
      .click()
      .else()
      .then(() => {
        cy.get('div:nth-child(3)>div:nth-child(2)>div:nth-child(1)>button:nth-child(3)')
          .if()
          .click();
      });

    cy.switchToMetamaskNotification();
    cy.wait(getRandomInt(8000, 16000));

    cy.confirmMetamaskTransaction({ gasConfig: 'aggressive' }).then(txData => {
      expect(txData.confirmed).to.be.true;
    });
    cy.switchToCypressWindow();

    cy.get('img[src="/assets/loading/success.svg"]', { timeout: 90000 }).should('exist');
    cy.task('warn', `Succesfully swapped!`);
    cy.reload();
  }

  function selectPairToSwap(args) {
    cy.task('warn', `Selecting pair to swap ${args.from}/${args.to} ..`);

    cy.get(
      'div:nth-child(3)>div:nth-child(1)>div:nth-child(1)>div:nth-child(1)>div:nth-child(1)>img:nth-child(2)',
    ).click();
    cy.findByPlaceholderText('Enter name or paste address')
      .first()
      .type(args.to)
      .blur()
      .wait(getRandomInt(400, 800))
      .get('body')
      .wait(getRandomInt(400, 800));
    cy.get('p').contains(args.to).first().click();

    cy.get(
      'div:nth-child(1)>div:nth-child(1)>div:nth-child(1)>div:nth-child(1)>div:nth-child(1)>img:nth-child(2)',
    ).click();
    cy.findByPlaceholderText('Enter name or paste address')
      .first()
      .type(args.from)
      .wait(getRandomInt(600, 800))
      .blur()
      .wait(getRandomInt(600, 800))
      .get('body')
      .wait(getRandomInt(400, 800));
    cy.get('p').contains(args.from).first().click();
  }

  function getRandomInt(min, max) {
    return Math.floor(min + Math.random() * (max + 1 - min));
  }
});
