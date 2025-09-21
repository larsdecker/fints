# fints-cli

[![npm](https://img.shields.io/npm/v/fints-cli.svg)](https://www.npmjs.com/package/fints-cli)
[![pipeline status](https://gitlab.com/prior99/fints/badges/master/pipeline.svg)](https://github.com/Prior99/fints)
[![coverage report](https://gitlab.com/prior99/fints/badges/master/coverage.svg)](https://github.com/Prior99/fints)


A command line interface for communicating with [FinTS servers](https://www.hbci-zka.de/).


## Features

- Load list of accounts.
- Load list of transactions in specified range.
- Fetch the current balance for an account.
- List holdings for depot accounts.
- Submit SEPA direct debits.
- Manage standing orders (list, create, update, cancel).

### List accounts

```
  List the accounts available for the specified user.

  USAGE

    fints list-accounts --url <url> --name <name> --pin <pin> --blz <blz> [...options]

  OPTIONS

    -u, --url <url>   - Endpoint URL.                
    -n, --name <name> - Username used for connecting. 
    -p, --pin <pin>   - Pin used for connecting.      
    -b, --blz <blz>   - BLZ of the bank to connect to.
    -d, --debug      
    -v, --verbose    
    -j, --json       
```

```
fint-cli list-accounts --url https://example.com/fints -n username -p 12345 -b 12345678
```

### Fetching transactions

```
  Fetch the statements for a specified account.

  USAGE

    fints fetch-transactions --url <url> --name <name> --pin <pin> --blz <blz> --iban <iban> [...options]

  OPTIONS

    -u, --url <url>     - Endpoint URL.                        
    -n, --name <name>   - Username used for connecting.         
    -p, --pin <pin>     - Pin used for connecting.              
    -b, --blz <blz>     - BLZ of the bank to connect to.        
    -d, --debug        
    -v, --verbose      
    -j, --json         
    -i, --iban <iban>   - IBAN of the account to fetch.         
    -s, --start <start> - Date of earliest transaction to fetch.
    -e, --end <end>     - Date of latest transaction to fetch.  
```

```
./fints-cli fetch-transactions --url http://example.com/fints -n username -p 12345 -b 12345678 -i DE111234567800000001 -s 2018-01-01 -e 2018-10-01
```

### Fetch current balance

```
  Fetch the current balance for a specified account.

  USAGE

    fints get-balance --url <url> --name <name> --pin <pin> --blz <blz> --iban <iban> [...options]

  OPTIONS

    -u, --url <url>   - Endpoint URL.
    -n, --name <name> - Username used for connecting.
    -p, --pin <pin>   - Pin used for connecting.
    -b, --blz <blz>   - BLZ of the bank to connect to.
    -d, --debug
    -v, --verbose
    -j, --json
    -i, --iban <iban> - IBAN of the account to fetch.
```

```
./fints-cli get-balance --url https://example.com/fints -n username -p 12345 -b 12345678 -i DE111234567800000001
```

### List holdings

```
  List the holdings of a depot account.

  USAGE

    fints list-holdings --url <url> --name <name> --pin <pin> --blz <blz> --iban <iban> [...options]

  OPTIONS

    -u, --url <url>   - Endpoint URL.
    -n, --name <name> - Username used for connecting.
    -p, --pin <pin>   - Pin used for connecting.
    -b, --blz <blz>   - BLZ of the bank to connect to.
    -d, --debug
    -v, --verbose
    -j, --json
    -i, --iban <iban> - IBAN of the depot account to fetch.
```

```
./fints-cli list-holdings --url https://example.com/fints -n username -p 12345 -b 12345678 -i DE111234567800000001
```

### Submit direct debit

```
  Submit a SEPA direct debit request.

  USAGE

    fints submit-direct-debit --url <url> --name <name> --pin <pin> --blz <blz> --account-iban <iban> --creditor-name <name> \
      --creditor-id <id> --debtor-name <name> --debtor-iban <iban> --amount <amount> --mandate-id <id> --mandate-date <date> \
      --collection-date <date> [...options]

  OPTIONS

    -u, --url <url>              - Endpoint URL.
    -n, --name <name>            - Username used for connecting.
    -p, --pin <pin>              - Pin used for connecting.
    -b, --blz <blz>              - BLZ of the bank to connect to.
    --account-iban <iban>        - IBAN of the creditor account.
    --creditor-name <name>       - Name of the creditor.
    --creditor-id <id>           - SEPA creditor identifier.
    --debtor-name <name>         - Name of the debtor.
    --debtor-iban <iban>         - IBAN of the debtor.
    --amount <amount>            - Amount to collect.
    --mandate-id <id>            - SEPA mandate identifier.
    --mandate-date <date>        - Mandate signature date (YYYY-MM-DD).
    --collection-date <date>     - Requested collection date (YYYY-MM-DD).
    --sequence-type <type>       - Sequence type (OOFF, FRST, RCUR, FNAL).
    --local-instrument <code>    - Local instrument (CORE or B2B).
    --end-to-end-id <id>         - End-to-end reference.
    --remittance <text>          - Unstructured remittance information.
    --purpose-code <code>        - Purpose code for the debit.
    --message-id <id>            - Optional message identifier.
    --payment-information-id <id>- Optional payment information identifier.
    --batch                      - Request batch booking.
    --tan <tan>                  - Provide TAN to skip the interactive prompt.
    -d, --debug
    -v, --verbose
    -j, --json
```

```
./fints-cli submit-direct-debit --url https://example.com/fints --name username --pin 12345 --blz 12345678 \
  --account-iban DE111234567800000001 --creditor-name "ACME GmbH" --creditor-id DE98ZZZ09999999999 \
  --debtor-name "John Doe" --debtor-iban DE02120300000000202051 --amount 42.50 --mandate-id MANDATE-123 \
  --mandate-date 2022-01-10 --collection-date 2022-01-15 --remittance "Invoice 0815"
```

### List standing orders

```
  List all standing orders configured for an account.

  USAGE

    fints list-standing-orders --url <url> --name <name> --pin <pin> --blz <blz> --iban <iban> [...options]

  OPTIONS

    -u, --url <url>   - Endpoint URL.
    -n, --name <name> - Username used for connecting.
    -p, --pin <pin>   - Pin used for connecting.
    -b, --blz <blz>   - BLZ of the bank to connect to.
    -d, --debug
    -v, --verbose
    -j, --json
    -i, --iban <iban> - IBAN of the account to inspect.
```

### Create a standing order

```
  Create a new standing order. If the bank requires a TAN the command
  will display the challenge and prompt for input.

  USAGE

    fints create-standing-order --url <url> --name <name> --pin <pin> --blz <blz> \
      --iban <iban> --amount <amount> --purpose <purpose> --creditor-name <name> \
      --creditor-iban <iban> --creditor-bic <bic> --start <date> --time-unit <unit> \
      --interval <interval> [...options]

  OPTIONS

    -u, --url <url>             - Endpoint URL.
    -n, --name <name>           - Username used for connecting.
    -p, --pin <pin>             - Pin used for connecting.
    -b, --blz <blz>             - BLZ of the bank to connect to.
    -i, --iban <iban>           - IBAN of the debit account.
    -a, --amount <amount>       - Amount transferred for each execution.
    -c, --currency <currency>   - Currency code (defaults to EUR).
    -P, --purpose <purpose>     - Payment purpose.
        --creditor-name <name>  - Creditor name.
        --creditor-iban <iban>  - Creditor IBAN.
        --creditor-bic <bic>    - Creditor BIC.
        --debitor-name <name>   - Optional override for the debitor name.
        --debitor-iban <iban>   - Optional override for the debitor IBAN.
        --debitor-bic <bic>     - Optional override for the debitor BIC.
    -s, --start <date>          - First execution date (YYYY-MM-DD).
    -t, --time-unit <unit>      - Time unit for the repetition (e.g. M).
    -n, --interval <interval>   - Interval for the repetition.
    -D, --execution-day <day>   - Optional execution day for monthly schedules.
    -e, --end <date>            - Optional end date (YYYY-MM-DD).
    -d, --debug
    -v, --verbose
    -j, --json
```

### Update a standing order

```
  Update an existing standing order by sending a full replacement.
  If a TAN is required you will be prompted to enter it.

  USAGE

    fints update-standing-order --url <url> --name <name> --pin <pin> --blz <blz> \
      --iban <iban> --order-id <id> --amount <amount> --purpose <purpose> \
      --creditor-name <name> --creditor-iban <iban> --creditor-bic <bic> \
      --start <date> --time-unit <unit> --interval <interval> [...options]

  OPTIONS mirror those from `create-standing-order` with the additional
  `--order-id` parameter to reference the existing standing order.
```

### Cancel a standing order

```
  Cancel a standing order using its identifier. The command first loads
  the current standing orders to obtain the required metadata.

  USAGE

    fints cancel-standing-order --url <url> --name <name> --pin <pin> --blz <blz> --iban <iban> --order-id <id> [...options]

  OPTIONS

    -u, --url <url>     - Endpoint URL.
    -n, --name <name>   - Username used for connecting.
    -p, --pin <pin>     - Pin used for connecting.
    -b, --blz <blz>     - BLZ of the bank to connect to.
    -i, --iban <iban>   - IBAN of the account to use.
    -O, --order-id <id> - Standing order identifier returned by the bank.
    -d, --debug
    -v, --verbose
    -j, --json
```

## Resources

- [Database of banks with their URLs](https://github.com/jhermsmeier/fints-institute-db)
