import { EquipmentActions, EquipmentActionTypes } from "./equipment.actions";
import { EquipmentItemBaseInterface, EquipmentItemType } from "@features/equipment/types/equipment-item-base.interface";
import { UtilsService } from "@shared/services/utils/utils.service";
import { BrandInterface } from "@features/equipment/types/brand.interface";
import { EditProposalInterface } from "@features/equipment/types/edit-proposal.interface";
import { arrayUniqueEquipmentItems, getEquipmentItemType } from "@features/equipment/store/equipment.selectors";
import { CameraInterface } from "@features/equipment/types/camera.interface";
import { EquipmentPresetInterface } from "@features/equipment/types/equipment-preset.interface";
import { EquipmentItemMostOftenUsedWithData } from "@features/equipment/types/equipment-item-most-often-used-with-data.interface";
import { ContributorInterface } from "@features/equipment/types/contributor.interface";

export const equipmentFeatureKey = "equipment";

export interface EquipmentState {
  brands: BrandInterface[];
  brandsCount: number;
  equipmentItems: EquipmentItemBaseInterface[];
  editProposals: EditProposalInterface<EquipmentItemBaseInterface>[];
  presets: EquipmentPresetInterface[];
  mostOftenUsedWithData: EquipmentItemMostOftenUsedWithData | {};
  contributors: ContributorInterface[];
}

export const initialEquipmentState: EquipmentState = {
  brands: [],
  brandsCount: null,
  equipmentItems: [],
  editProposals: [],
  presets: [],
  mostOftenUsedWithData: {},
  contributors: []
};

function editProposalCompareFunction(
  a: EditProposalInterface<EquipmentItemBaseInterface>,
  b: EditProposalInterface<EquipmentItemBaseInterface>
): number {
  const aDate: Date = new Date(a.editProposalCreated + "Z");
  const bDate: Date = new Date(b.editProposalCreated + "Z");

  if (aDate < bDate) {
    return -1;
  }

  if (aDate > bDate) {
    return 1;
  }

  return 0;
}

export function reducer(state = initialEquipmentState, action: EquipmentActions): EquipmentState {
  switch (action.type) {
    case EquipmentActionTypes.GET_ALL_BRANDS_SUCCESS:
      return {
        ...state,
        brands: UtilsService.arrayUniqueObjects([...state.brands, ...action.payload.response.results], "id"),
        brandsCount: action.payload.response.count
      };

    case EquipmentActionTypes.LOAD_BRAND_SUCCESS:
    case EquipmentActionTypes.CREATE_BRAND_SUCCESS: {
      return {
        ...state,
        brands: UtilsService.arrayUniqueObjects([...state.brands, ...[action.payload.brand]], "id")
      };
    }

    case EquipmentActionTypes.FIND_ALL_BRANDS_SUCCESS: {
      return {
        ...state,
        brands: UtilsService.arrayUniqueObjects([...state.brands, ...action.payload.brands], "id")
      };
    }

    case EquipmentActionTypes.FIND_ALL_EQUIPMENT_ITEMS_SUCCESS:
    case EquipmentActionTypes.FIND_RECENTLY_USED_EQUIPMENT_ITEMS_SUCCESS:
    case EquipmentActionTypes.FIND_SIMILAR_IN_BRAND_SUCCESS:
    case EquipmentActionTypes.GET_OTHERS_IN_BRAND_SUCCESS: {
      return {
        ...state,
        equipmentItems: arrayUniqueEquipmentItems([...state.equipmentItems, ...action.payload.items])
      };
    }

    case EquipmentActionTypes.GET_ALL_IN_BRAND_SUCCESS: {
      return {
        ...state,
        equipmentItems: arrayUniqueEquipmentItems([...state.equipmentItems, ...action.payload.response.results])
      };
    }

    case EquipmentActionTypes.LOAD_EQUIPMENT_ITEM_SUCCESS:
    case EquipmentActionTypes.APPROVE_EQUIPMENT_ITEM_SUCCESS:
    case EquipmentActionTypes.UNAPPROVE_EQUIPMENT_ITEM_SUCCESS:
    case EquipmentActionTypes.CREATE_SENSOR_SUCCESS:
    case EquipmentActionTypes.CREATE_CAMERA_SUCCESS:
    case EquipmentActionTypes.CREATE_TELESCOPE_SUCCESS:
    case EquipmentActionTypes.CREATE_MOUNT_SUCCESS:
    case EquipmentActionTypes.CREATE_FILTER_SUCCESS:
    case EquipmentActionTypes.CREATE_ACCESSORY_SUCCESS:
    case EquipmentActionTypes.CREATE_SOFTWARE_SUCCESS:
    case EquipmentActionTypes.LOAD_SENSOR_SUCCESS:
    case EquipmentActionTypes.ASSIGN_ITEM_SUCCESS:
    case EquipmentActionTypes.FREEZE_EQUIPMENT_ITEM_AS_AMBIGUOUS_SUCCESS:
    case EquipmentActionTypes.UNFREEZE_EQUIPMENT_ITEM_AS_AMBIGUOUS_SUCCESS: {
      return {
        ...state,
        equipmentItems: arrayUniqueEquipmentItems([...state.equipmentItems, ...[action.payload.item]])
      };
    }

    case EquipmentActionTypes.REJECT_EQUIPMENT_ITEM_SUCCESS: {
      const rejectedItem = action.payload.item;
      let equipmentItems = arrayUniqueEquipmentItems([...state.equipmentItems, ...[rejectedItem]]);

      if (rejectedItem.klass === EquipmentItemType.SENSOR) {
        // Update cameras that used to have this sensors.
        equipmentItems = equipmentItems.map(equipmentItem => {
          if (
            equipmentItem.klass === EquipmentItemType.CAMERA &&
            (equipmentItem as CameraInterface).sensor === rejectedItem.id
          ) {
            (equipmentItem as CameraInterface).sensor = null;
          }

          return equipmentItem;
        });
      }

      return {
        ...state,
        equipmentItems: equipmentItems.filter(item => item.klass !== rejectedItem.klass && item.id !== rejectedItem.id)
      };
    }

    case EquipmentActionTypes.CREATE_SENSOR_EDIT_PROPOSAL_SUCCESS:
    case EquipmentActionTypes.CREATE_CAMERA_EDIT_PROPOSAL_SUCCESS:
    case EquipmentActionTypes.CREATE_TELESCOPE_EDIT_PROPOSAL_SUCCESS:
    case EquipmentActionTypes.CREATE_MOUNT_EDIT_PROPOSAL_SUCCESS:
    case EquipmentActionTypes.CREATE_FILTER_EDIT_PROPOSAL_SUCCESS:
    case EquipmentActionTypes.CREATE_ACCESSORY_EDIT_PROPOSAL_SUCCESS:
    case EquipmentActionTypes.CREATE_SOFTWARE_EDIT_PROPOSAL_SUCCESS:
    case EquipmentActionTypes.REJECT_EQUIPMENT_ITEM_EDIT_PROPOSAL_SUCCESS:
    case EquipmentActionTypes.ASSIGN_EDIT_PROPOSAL_SUCCESS: {
      return {
        ...state,
        editProposals: (arrayUniqueEquipmentItems([
          ...state.editProposals,
          ...[action.payload.editProposal]
        ]) as EditProposalInterface<EquipmentItemBaseInterface>[])
          .sort(editProposalCompareFunction)
          .reverse()
      };
    }

    case EquipmentActionTypes.APPROVE_EQUIPMENT_ITEM_EDIT_PROPOSAL_SUCCESS: {
      return {
        ...state,
        equipmentItems: state.equipmentItems.filter(item => {
          return (
            item.id !== action.payload.editProposal.editProposalTarget &&
            getEquipmentItemType(item) !== getEquipmentItemType(action.payload.editProposal)
          );
        }),
        editProposals: (arrayUniqueEquipmentItems([
          ...state.editProposals,
          ...[action.payload.editProposal]
        ]) as EditProposalInterface<EquipmentItemBaseInterface>[])
          .sort(editProposalCompareFunction)
          .reverse()
      };
    }

    case EquipmentActionTypes.FIND_EQUIPMENT_ITEM_EDIT_PROPOSALS_SUCCESS: {
      return {
        ...state,
        editProposals: UtilsService.arrayUniqueObjects(
          [...state.editProposals, ...action.payload.editProposals.results].sort(editProposalCompareFunction).reverse(),
          "id"
        )
      };
    }

    case EquipmentActionTypes.FIND_EQUIPMENT_PRESETS_SUCCESS: {
      return {
        ...state,
        presets: UtilsService.arrayUniqueObjects([...state.presets, ...action.payload.presets], "id")
      };
    }

    case EquipmentActionTypes.CREATE_EQUIPMENT_PRESET_SUCCESS:
    case EquipmentActionTypes.UPDATE_EQUIPMENT_PRESET_SUCCESS: {
      return {
        ...state,
        presets: UtilsService.arrayUniqueObjects([...state.presets, action.payload.preset], "id")
      };
    }

    case EquipmentActionTypes.DELETE_EQUIPMENT_PRESET_SUCCESS: {
      return {
        ...state,
        presets: state.presets.filter(preset => preset.id !== action.payload.id)
      };
    }

    case EquipmentActionTypes.GET_MOST_OFTEN_USED_WITH_SUCCESS: {
      const key = `${action.payload.itemType}-${action.payload.itemId}`;
      return {
        ...state,
        mostOftenUsedWithData: {
          ...state.mostOftenUsedWithData,
          ...{
            [key]: action.payload.data
          }
        }
      };
    }

    case EquipmentActionTypes.GET_CONTRIBUTORS_SUCCESS: {
      return {
        ...state,
        contributors: action.payload.contributors
      };
    }

    default: {
      return state;
    }
  }
}
