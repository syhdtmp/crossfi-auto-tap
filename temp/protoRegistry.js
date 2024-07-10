import {
  defaultRegistryTypes,
} from '@cosmjs/stargate';

import pkg from '@cosmjs/proto-signing';
const { Registry, GeneratedType } = pkg;
import { SoftwareUpgradeProposal, CancelSoftwareUpgradeProposal } from '../cosmjs-types/build/cosmos/upgrade/v1beta1/upgrade.js';
// import { MsgSoftwareUpgrade, MsgCancelUpgrade } from './cosmjs-types/build/cosmos/upgrade/v1beta1/tx.js';
import { ParameterChangeProposal } from '../cosmjs-types/build/cosmos/params/v1beta1/params.js';
import { MsgUpdateParams as MsgFeemarketUpdateParams } from '../cosmjs-types/build/ethermint/feemarket/v1/tx.js'
import { MsgEthereumTx, DynamicFeeTx, LegacyTx } from '../cosmjs-types/build/ethermint/evm/v1/tx.js';
// import { MsgExecLegacyContent } from './cosmjs-types/build/cosmos/gov/v1beta1/tx.js';
import { CommunityPoolSpendProposal } from '../cosmjs-types/build/cosmos/distribution/v1beta1/distribution.js';
import { Proposal } from '../cosmjs-types/build/cosmos/gov/v1beta1/gov.js';
import * as ethermint from '../cosmjs-types/build/ethermint/crypto/v1/ethsecp256k1/keys.js'
import * as cosmos from '../cosmjs-types/build/cosmos/crypto/secp256k1/keys.js';
import * as ed25519 from '../cosmjs-types/build/cosmos/crypto/ed25519/keys.js';

// Map message type strings to decoder functions
const _protoRegistry = new Registry(defaultRegistryTypes)
_protoRegistry.register(CommunityPoolSpendProposal.typeUrl, CommunityPoolSpendProposal)
// _protoRegistry.register(MsgExecLegacyContent.typeUrl, MsgExecLegacyContent)
_protoRegistry.register(Proposal.typeUrl, Proposal)
_protoRegistry.register(SoftwareUpgradeProposal.typeUrl, SoftwareUpgradeProposal)
_protoRegistry.register(MsgEthereumTx.typeUrl, MsgEthereumTx)
_protoRegistry.register(LegacyTx.typeUrl, LegacyTx)
_protoRegistry.register(ethermint.PubKey.typeUrl, ethermint.PubKey)
_protoRegistry.register(cosmos.PubKey.typeUrl, cosmos.PubKey)
_protoRegistry.register(ed25519.PubKey.typeUrl, ed25519.PubKey)
_protoRegistry.register(DynamicFeeTx.typeUrl, DynamicFeeTx)
_protoRegistry.register(CancelSoftwareUpgradeProposal.typeUrl, CancelSoftwareUpgradeProposal)
_protoRegistry.register(ParameterChangeProposal.typeUrl, ParameterChangeProposal)
// _protoRegistry.register(MsgCancelUpgrade.typeUrl, MsgCancelUpgrade)
// _protoRegistry.register(MsgSoftwareUpgrade.typeUrl, MsgSoftwareUpgrade)
_protoRegistry.register(MsgFeemarketUpdateParams.typeUrl, MsgFeemarketUpdateParams)

export const protoRegistry = _protoRegistry