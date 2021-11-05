import { AfterViewInit, Component, EventEmitter, Input, OnInit, Output, TemplateRef, ViewChild } from "@angular/core";
import { FormlyFieldConfig } from "@ngx-formly/core";
import { FormControl, FormGroup } from "@angular/forms";
import { TranslateService } from "@ngx-translate/core";
import { EquipmentApiService } from "@features/equipment/services/equipment-api.service";
import { of } from "rxjs";
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  first,
  map,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap
} from "rxjs/operators";
import { BrandInterface } from "@features/equipment/types/brand.interface";
import { Store } from "@ngrx/store";
import { BaseComponentDirective } from "@shared/components/base-component.directive";
import { State } from "@app/store/state";
import { WindowRefService } from "@shared/services/window-ref.service";
import { FormlyFieldMessageLevel, FormlyFieldService } from "@shared/services/formly-field.service";

@Component({
  selector: "astrobin-brand-editor",
  templateUrl: "./brand-editor.component.html",
  styleUrls: ["./brand-editor.component.scss"]
})
export class BrandEditorComponent extends BaseComponentDirective implements OnInit, AfterViewInit {
  static MIN_LENGTH_FOR_SUGGESTIONS = 3;

  fields: FormlyFieldConfig[];

  @Input()
  form: FormGroup = new FormGroup({});

  @Input()
  model: Partial<BrandInterface> = {};

  @Input()
  name: string;

  @Output()
  suggestionSelected = new EventEmitter<BrandInterface>();

  @ViewChild("similarItemsTemplate")
  similarItemsTemplate: TemplateRef<any>;

  constructor(
    public readonly store$: Store<State>,
    public readonly translateService: TranslateService,
    public readonly equipmentApiService: EquipmentApiService,
    public readonly windowRefService: WindowRefService,
    public readonly formlyFieldService: FormlyFieldService
  ) {
    super(store$);
  }

  ngOnInit(): void {
    if (this.name?.length >= BrandEditorComponent.MIN_LENGTH_FOR_SUGGESTIONS) {
      this.equipmentApiService
        .findAllBrands(this.name)
        .pipe(take(1))
        .subscribe(similarBrands => {
          this._showSimilarBrandsWarning(similarBrands);
        });
    }

    this.fields = [
      {
        key: "name",
        type: "input",
        wrappers: ["default-wrapper"],
        id: "brand-field-name",
        defaultValue: this.name,
        templateOptions: {
          required: true,
          label: this.translateService.instant("Name"),
          description: this.translateService.instant("The name of this brand. Make sure it's spelled correctly.")
        },
        hooks: {
          onInit: field => {
            field.formControl.valueChanges
              .pipe(
                takeUntil(this.destroyed$),
                filter(value => !!value),
                switchMap(value => {
                  if (value.length >= BrandEditorComponent.MIN_LENGTH_FOR_SUGGESTIONS) {
                    return this.equipmentApiService.findAllBrands(value);
                  } else {
                    return of([]);
                  }
                }),
                tap(similarBrands => {
                  this.formlyFieldService.clearMessages(field.templateOptions);
                  this._showSimilarBrandsWarning(similarBrands);
                })
              )
              .subscribe();
          }
        },
        asyncValidators: {
          unique: {
            expression: (control: FormControl) => {
              return control.valueChanges.pipe(
                startWith(control.value),
                debounceTime(500),
                distinctUntilChanged(),
                switchMap(value => this.equipmentApiService.getBrandsByName(value)),
                map(brands => brands.count === 0),
                first()
              );
            },
            message: this.translateService.instant("A brand with this name already exists.")
          }
        }
      },
      {
        key: "website",
        type: "input",
        wrappers: ["default-wrapper"],
        id: "brand-field-website",
        templateOptions: {
          required: true,
          label: this.translateService.instant("Website")
        },
        validators: {
          validation: ["url"]
        },
        asyncValidators: {
          urlIsAvailable: "url-is-available",
          unique: {
            expression: (control: FormControl) => {
              return control.valueChanges.pipe(
                startWith(control.value),
                debounceTime(500),
                distinctUntilChanged(),
                switchMap(value => this.equipmentApiService.getBrandsByWebsite(value)),
                map(brands => brands.count === 0),
                first()
              );
            },
            message: this.translateService.instant("A brand with this website already exists.")
          }
        }
      },
      {
        key: "logo",
        type: "file",
        id: "brand-field-logo",
        templateOptions: {
          required: false,
          label: this.translateService.instant("Logo"),
          accept: "image/jpeg, image/png"
        }
      }
    ];
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      const document = this.windowRefService.nativeWindow.document;
      (document.querySelector("#brand-field-name") as HTMLElement).focus();
    }, 100);
  }

  private _showSimilarBrandsWarning(similarBrands: BrandInterface[]) {
    const fieldConfig = this.fields.find(fields => fields.key === "name");
    let template = null;
    let data = null;

    if (similarBrands.length > 0) {
      template = this.similarItemsTemplate;
      data = similarBrands;

      this.formlyFieldService.addMessage(fieldConfig.templateOptions, {
        level: FormlyFieldMessageLevel.WARNING,
        template,
        data
      });
    }
  }
}