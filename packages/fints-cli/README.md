# fints-lib-cli

[![npm](https://img.shields.io/npm/v/fints-lib-cli.svg)](https://www.npmjs.com/package/fints-lib-cli)
[![CI](https://github.com/larsdecker/fints/actions/workflows/ci.yml/badge.svg)](https://github.com/larsdecker/fints/actions/workflows/ci.yml)


A command line interface for communicating with [FinTS servers](https://www.hbci-zka.de/).

> **Note:** This is a fork and continuation of [Prior99/fints](https://github.com/Prior99/fints). Published as `fints-lib-cli` on npm.

## Installation

```bash
npm install -g fints-lib-cli
# or
yarn global add fints-lib-cli
```


## Features

- Load list of accounts.
- Load list of transactions in specified range.
- Fetch the current balance for an account.
- List holdings for depot accounts.
- Submit SEPA credit transfers.
- Submit SEPA direct debits.

### List accounts

```
  List the accounts available for the specified user.

  USAGE

    fints-lib list-accounts --url <url> --name <name> --pin <pin> --blz <blz> [...options]

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
fints-lib list-accounts --url https://example.com/fints -n username -p 12345 -b 12345678
```

### Fetching transactions

```
  Fetch the statements for a specified account.

  USAGE

    fints-lib fetch-transactions --url <url> --name <name> --pin <pin> --blz <blz> --iban <iban> [...options]

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
fints-lib fetch-transactions --url http://example.com/fints -n username -p 12345 -b 12345678 -i DE111234567800000001 -s 2018-01-01 -e 2018-10-01
```

### Fetch current balance

```
  Fetch the current balance for a specified account.

  USAGE

    fints-lib get-balance --url <url> --name <name> --pin <pin> --blz <blz> --iban <iban> [...options]

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
fints-lib get-balance --url https://example.com/fints -n username -p 12345 -b 12345678 -i DE111234567800000001
```

### List holdings

```
  List the holdings of a depot account.

  USAGE

    fints-lib list-holdings --url <url> --name <name> --pin <pin> --blz <blz> --iban <iban> [...options]

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
fints-lib list-holdings --url https://example.com/fints -n username -p 12345 -b 12345678 -i DE111234567800000001
```

### Submit credit transfer

```
  Submit a SEPA credit transfer request.

  USAGE

    fints-lib submit-credit-transfer --url <url> --name <name> --pin <pin> --blz <blz> --account-iban <iban> --creditor-name <name> \
      --creditor-iban <iban> --amount <amount> [...options]

  OPTIONS

    -u, --url <url>              - Endpoint URL.
    -n, --name <name>            - Username used for connecting.
    -p, --pin <pin>              - Pin used for connecting.
    -b, --blz <blz>              - BLZ of the bank to connect to.
    --account-iban <iban>        - IBAN of the debtor account.
    --debtor-name <name>         - Name of the debtor.
    --creditor-name <name>       - Name of the creditor.
    --creditor-iban <iban>       - IBAN of the creditor.
    --creditor-bic <bic>         - BIC of the creditor (optional).
    --amount <amount>            - Amount to transfer.
    --execution-date <date>      - Requested execution date (YYYY-MM-DD).
    --end-to-end-id <id>         - End-to-end reference.
    --remittance <text>          - Unstructured remittance information.
    --purpose-code <code>        - Purpose code for the transfer.
    --message-id <id>            - Optional message identifier.
    --payment-information-id <id>- Optional payment information identifier.
    --batch                      - Request batch booking.
    --tan <tan>                  - Provide TAN to skip the interactive prompt.
    -d, --debug
    -v, --verbose
    -j, --json
```

```
fints-lib submit-credit-transfer --url https://example.com/fints --name username --pin 12345 --blz 12345678 \
  --account-iban DE02120300000000202051 --debtor-name "John Doe" --creditor-name "ACME GmbH" \
  --creditor-iban DE44500105175407324931 --amount 100.00 --remittance "Invoice 0815"
```

### Submit direct debit

```
  Submit a SEPA direct debit request.

  USAGE

    fints-lib submit-direct-debit --url <url> --name <name> --pin <pin> --blz <blz> --account-iban <iban> --creditor-name <name> \
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
fints-lib submit-direct-debit --url https://example.com/fints --name username --pin 12345 --blz 12345678 \
  --account-iban DE111234567800000001 --creditor-name "ACME GmbH" --creditor-id DE98ZZZ09999999999 \
  --debtor-name "John Doe" --debtor-iban DE02120300000000202051 --amount 42.50 --mandate-id MANDATE-123 \
  --mandate-date 2022-01-10 --collection-date 2022-01-15 --remittance "Invoice 0815"
```

## Resources

- [Database of banks with their URLs](https://github.com/jhermsmeier/fints-institute-db)
