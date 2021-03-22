import { Component, OnInit, TemplateRef, ViewChild } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { AppActionTypes } from "@app/store/actions/app.actions";
import { SetBreadcrumb } from "@app/store/actions/breadcrumb.actions";
import { SaveImage } from "@app/store/actions/image.actions";
import { LoadThumbnail } from "@app/store/actions/thumbnail.actions";
import { selectThumbnail } from "@app/store/selectors/app/thumbnail.selectors";
import { State } from "@app/store/state";
import { selectCurrentUser } from "@features/account/store/auth.selectors";
import { ImageEditorSetCropperShown } from "@features/image/store/image.actions";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { Actions, ofType } from "@ngrx/effects";
import { Store } from "@ngrx/store";
import { FormlyFieldConfig } from "@ngx-formly/core";
import { TranslateService } from "@ngx-translate/core";
import { BaseComponentDirective } from "@shared/components/base-component.directive";
import { ImageAlias } from "@shared/enums/image-alias.enum";
import {
  AcquisitionType,
  DataSource,
  ImageInterface,
  MouseHoverImageOptions,
  RemoteSource,
  SolarSystemSubjectType,
  SubjectType,
  WatermarkPositionOptions,
  WatermarkSizeOptions
} from "@shared/interfaces/image.interface";
import { RemoteSourceAffiliateInterface } from "@shared/interfaces/remote-source-affiliate.interface";
import { GroupApiService } from "@shared/services/api/classic/groups/group-api.service";
import { RemoteSourceAffiliateApiService } from "@shared/services/api/classic/remote-source-affiliation/remote-source-affiliate-api.service";
import { ClassicRoutesService } from "@shared/services/classic-routes.service";
import { LoadingService } from "@shared/services/loading.service";
import { TitleService } from "@shared/services/title/title.service";
import { UtilsService } from "@shared/services/utils/utils.service";
import { WindowRefService } from "@shared/services/window-ref.service";
import { catchError, map, switchMap } from "rxjs/operators";
import { retryWithDelay } from "rxjs-boost/lib/operators";
import { PopNotificationsService } from "@shared/services/pop-notifications.service";
import { EMPTY } from "rxjs";

@Component({
  selector: "astrobin-image-edit-page",
  templateUrl: "./image-edit-page.component.html",
  styleUrls: ["./image-edit-page.component.scss"]
})
export class ImageEditPageComponent extends BaseComponentDirective implements OnInit {
  ImageAlias = ImageAlias;
  image: ImageInterface;
  model: Partial<ImageInterface>;
  form = new FormGroup({});
  fields: FormlyFieldConfig[];
  remoteSourceAffiliates: RemoteSourceAffiliateInterface[];

  @ViewChild("remoteSourceLabelTemplate")
  remoteSourceLabelTemplate: TemplateRef<any>;

  @ViewChild("remoteSourceOptionTemplate")
  remoteSourceOptionTemplate: TemplateRef<any>;

  @ViewChild("returnToClassicConfirmationModalTemplate")
  returnToClassicConfirmationModalTemplate: TemplateRef<any>;

  @ViewChild("stepperButtonsTemplate")
  stepperButtonsTemplate: TemplateRef<any>;

  constructor(
    public readonly store$: Store<State>,
    public readonly actions$: Actions,
    public readonly route: ActivatedRoute,
    public readonly router: Router,
    public readonly translateService: TranslateService,
    public readonly classicRoutesService: ClassicRoutesService,
    public readonly titleService: TitleService,
    public readonly remoteSourceAffiliateApiService: RemoteSourceAffiliateApiService,
    public readonly groupApiService: GroupApiService,
    public readonly loadingService: LoadingService,
    public readonly modalService: NgbModal,
    public readonly utilsService: UtilsService,
    public readonly windowRefService: WindowRefService,
    public readonly popNotificationsService: PopNotificationsService
  ) {
    super();
  }

  get newImageDataEditorAlert(): string {
    return this.translateService.instant(
      "Welcome to the new image data editor! In case of problems, please {{0}}let us know{{1}}!",
      {
        0: `<a href="${this.classicRoutesService.CONTACT}" target="_blank">`,
        1: "</a>"
      }
    );
  }

  ngOnInit(): void {
    this.image = this.route.snapshot.data.image;
    this.model = { ...this.image };
    this.titleService.setTitle("Edit image");

    this._initBreadcrumb();

    this.store$.dispatch(new LoadThumbnail({ id: this.image.pk, revision: "0", alias: ImageAlias.HD }));

    this.route.fragment.subscribe((fragment: string) => {
      if (!fragment) {
        this.router.navigate([`/i/${this.image.hash || this.image.pk}/edit`], { fragment: "1" });
      } else if (fragment === "1") {
        this.store$.dispatch(new ImageEditorSetCropperShown(true));
      }
    });

    this.remoteSourceAffiliateApiService.getAll().subscribe(remoteSourceAffiliates => {
      this.remoteSourceAffiliates = remoteSourceAffiliates;
      this._initFields();
    });
  }

  public isSponsor(code: string): boolean {
    return (
      this.remoteSourceAffiliates.filter(affiliate => {
        const now = new Date();
        return (
          affiliate.code === code &&
          new Date(affiliate.affiliationStart) <= now &&
          new Date(affiliate.affiliationExpiration) > now
        );
      }).length > 0
    );
  }

  onReturnToClassicEditor() {
    this.loadingService.setLoading(true);
    this.utilsService.openLink(
      this.windowRefService.nativeWindow.document,
      this.classicRoutesService.EDIT_IMAGE_THUMBNAILS(this.image.hash || "" + this.image.pk) + "?upload"
    );
  }

  onSave(event: Event, next: string) {
    if (event) {
      event.preventDefault();
    }

    if (!this.form.valid) {
      this.popNotificationsService.error(
        this.translateService.instant("Please check that all required fields have been filled at every step."),
        "The form is incomplete or has errors.",
        {
          timeOut: 10000
        }
      );
      return;
    }

    this.store$.dispatch(new SaveImage({ pk: this.image.pk, data: { ...this.image, ...this.form.value } }));
    this.actions$.pipe(ofType(AppActionTypes.SAVE_IMAGE_SUCCESS)).subscribe(() => {
      this.loadingService.setLoading(true);
      this.utilsService.openLink(this.windowRefService.nativeWindow.document, next);
    });
  }

  openClassicEditorRedirectConfirmationModal(): boolean {
    this.modalService.open(this.returnToClassicConfirmationModalTemplate, { centered: true });
    return false;
  }

  private _getTitleField(): any {
    return {
      key: "title",
      type: "input",
      id: "image-title-field",
      templateOptions: {
        label: this.translateService.instant("Title"),
        required: true
      }
    };
  }

  private _getDescriptionField(): any {
    return {
      key: "description",
      type: "textarea",
      id: "image-description-field",
      templateOptions: {
        label: this.translateService.instant("Description"),
        description: this.translateService.instant("HTML tags are allowed."),
        required: false,
        rows: 10
      }
    };
  }

  private _getLinkField(): any {
    return {
      key: "link",
      type: "input",
      id: "image-link-field",
      templateOptions: {
        label: this.translateService.instant("Link"),
        description: this.translateService.instant(
          "If you're hosting a copy of this image on your website, put the address here."
        ),
        placeholder: this.translateService.instant("e.g.") + " https://www.example.com/my-page.html",
        required: false
      },
      validators: {
        validation: ["url"]
      }
    };
  }

  private _getLinkToFitsField(): any {
    return {
      key: "linkToFits",
      type: "input",
      id: "image-link-to-fits-field",
      templateOptions: {
        label: this.translateService.instant("Link to TIFF/FITS"),
        description: this.translateService.instant(
          "If you want to share the TIFF or FITS file of your image, put a link to the file here. " +
            "Unfortunately, AstroBin cannot offer to store these files at the moment, so you will have to " +
            "host them on your personal space."
        ),
        placeholder: this.translateService.instant("e.g.") + " https://www.example.com/my-page.html",
        required: false
      },
      validators: {
        validation: ["url"]
      }
    };
  }

  private _getAcquisitionTypeField(): any {
    return {
      key: "acquisitionType",
      type: "ng-select",
      id: "image-acquisition-type-field",
      templateOptions: {
        required: true,
        label: this.translateService.instant("Acquisition type"),
        options: [
          {
            value: AcquisitionType.REGULAR,
            label: this.translateService.instant("Regular (e.g. medium/long exposure with a CCD or DSLR)")
          },
          {
            value: AcquisitionType.EAA,
            label: this.translateService.instant(
              "Electronically-Assisted Astronomy (EAA, e.g. based on a live video feed)"
            )
          },
          {
            value: AcquisitionType.LUCKY,
            label: this.translateService.instant("Lucky imaging")
          },
          {
            value: AcquisitionType.DRAWING,
            label: this.translateService.instant("Drawing/Sketch")
          },
          {
            value: AcquisitionType.OTHER,
            label: this.translateService.instant("Other/Unknown")
          }
        ]
      }
    };
  }

  private _getSubjectTypeField(): any {
    return {
      key: "subjectType",
      type: "ng-select",
      id: "image-subject-type-field",
      templateOptions: {
        required: true,
        label: this.translateService.instant("Subject type"),
        options: [
          { value: SubjectType.DEEP_SKY, label: this.translateService.instant("Deep sky object or field") },
          { value: SubjectType.SOLAR_SYSTEM, label: this.translateService.instant("Solar system body or event") },
          { value: SubjectType.WIDE_FIELD, label: this.translateService.instant("Extremely wide field") },
          { value: SubjectType.STAR_TRAILS, label: this.translateService.instant("Star trails") },
          { value: SubjectType.NORTHERN_LIGHTS, label: this.translateService.instant("Northern lights") },
          { value: SubjectType.GEAR, label: this.translateService.instant("Gear") },
          { value: SubjectType.OTHER, label: this.translateService.instant("Other") }
        ]
      },
      hooks: {
        onInit: (field: FormlyFieldConfig) => {
          field.formControl.valueChanges.subscribe(value => {
            if (value !== SubjectType.SOLAR_SYSTEM) {
              this.model.solarSystemMainSubject = null;
            }
          });
        }
      }
    };
  }

  private _getSolarSystemMainSubjectField(): any {
    return {
      key: "solarSystemMainSubject",
      type: "ng-select",
      id: "image-solar-system-main-subject-field",
      hideExpression: () => this.model.subjectType !== SubjectType.SOLAR_SYSTEM,
      expressionProperties: {
        "templateOptions.required": "model.subjectType === 'SOLAR_SYSTEM'"
      },
      templateOptions: {
        label: this.translateService.instant("Main solar system subject"),
        options: [
          { value: SolarSystemSubjectType.SUN, label: this.translateService.instant("Sun") },
          { value: SolarSystemSubjectType.MOON, label: this.translateService.instant("Earth's Moon") },
          { value: SolarSystemSubjectType.MERCURY, label: this.translateService.instant("Mercury") },
          { value: SolarSystemSubjectType.VENUS, label: this.translateService.instant("Venus") },
          { value: SolarSystemSubjectType.MARS, label: this.translateService.instant("Mars") },
          { value: SolarSystemSubjectType.JUPITER, label: this.translateService.instant("Jupiter") },
          { value: SolarSystemSubjectType.SATURN, label: this.translateService.instant("Saturn") },
          { value: SolarSystemSubjectType.URANUS, label: this.translateService.instant("Uranus") },
          { value: SolarSystemSubjectType.NEPTUNE, label: this.translateService.instant("Neptune") },
          { value: SolarSystemSubjectType.MINOR_PLANET, label: this.translateService.instant("Minor planet") },
          { value: SolarSystemSubjectType.COMET, label: this.translateService.instant("Comet") },
          { value: SolarSystemSubjectType.OCCULTATION, label: this.translateService.instant("Occultation") },
          { value: SolarSystemSubjectType.CONJUNCTION, label: this.translateService.instant("Conjunction") },
          {
            value: SolarSystemSubjectType.PARTIAL_LUNAR_ECLIPSE,
            label: this.translateService.instant("Partial lunar eclipse")
          },
          {
            value: SolarSystemSubjectType.TOTAL_LUNAR_ECLIPSE,
            label: this.translateService.instant("Total lunar eclipse")
          },
          {
            value: SolarSystemSubjectType.PARTIAL_SOLAR_ECLIPSE,
            label: this.translateService.instant("Partial solar eclipse")
          },
          {
            value: SolarSystemSubjectType.ANULAR_SOLAR_ECLIPSE,
            label: this.translateService.instant("Anular solar eclipse")
          },
          {
            value: SolarSystemSubjectType.TOTAL_SOLAR_ECLIPSE,
            label: this.translateService.instant("Total solar eclipse")
          },
          { value: SolarSystemSubjectType.OTHER, label: this.translateService.instant("Other") }
        ]
      }
    };
  }

  private _getDataSourceField(): any {
    return {
      key: "dataSource",
      type: "ng-select",
      id: "image-data-source-field",
      templateOptions: {
        required: true,
        label: this.translateService.instant("Data source"),
        description: this.translateService.instant("Where does the data for this image come from?"),
        options: [
          {
            value: DataSource.BACKYARD,
            label: this.translateService.instant("Backyard"),
            group: this.translateService.instant("Self acquired")
          },
          {
            value: DataSource.TRAVELLER,
            label: this.translateService.instant("Traveller"),
            group: this.translateService.instant("Self acquired")
          },
          {
            value: DataSource.OWN_REMOTE,
            label: this.translateService.instant("Own remote observatory"),
            group: this.translateService.instant("Self acquired")
          },
          {
            value: DataSource.AMATEUR_HOSTING,
            label: this.translateService.instant("Amateur hosting facility"),
            group: this.translateService.instant("Downloaded")
          },
          {
            value: DataSource.PUBLIC_AMATEUR_DATA,
            label: this.translateService.instant("Public amateur data"),
            group: this.translateService.instant("Downloaded")
          },
          {
            value: DataSource.PRO_DATA,
            label: this.translateService.instant("Professional, scientific grade data"),
            group: this.translateService.instant("Downloaded")
          },
          {
            value: DataSource.MIX,
            label: this.translateService.instant("Mix of multiple sources"),
            group: this.translateService.instant("Other")
          },
          {
            value: DataSource.OTHER,
            label: this.translateService.instant("None of the above"),
            group: this.translateService.instant("Other")
          },
          {
            value: DataSource.UNKNOWN,
            label: this.translateService.instant("Unknown"),
            group: this.translateService.instant("Other")
          }
        ]
      },
      hooks: {
        onInit: (field: FormlyFieldConfig) => {
          field.formControl.valueChanges.subscribe(value => {
            if ([DataSource.OWN_REMOTE, DataSource.AMATEUR_HOSTING].indexOf(value) === -1) {
              this.model.remoteSource = null;
            }
          });
        }
      }
    };
  }

  private _getRemoteSourceField(): any {
    return {
      key: "remoteSource",
      type: "ng-select",
      id: "image-remote-source-field",
      hideExpression: () => [DataSource.OWN_REMOTE, DataSource.AMATEUR_HOSTING].indexOf(this.model.dataSource) === -1,
      expressionProperties: {
        "templateOptions.required": "model.dataSource === 'OWN_REMOTE' || model.dataSource === 'AMATEUR_HOSTING'"
      },
      templateOptions: {
        label: this.translateService.instant("Remote data source"),
        description: this.translateService.instant(
          "Which remote hosting facility did you use to acquire data for this image?"
        ),
        labelTemplate: this.remoteSourceLabelTemplate,
        optionTemplate: this.remoteSourceOptionTemplate,
        options: [
          ...Array.from(Object.keys(RemoteSource)).map(key => ({
            value: key,
            label: RemoteSource[key],
            group: this.translateService.instant("Commercial facilities")
          })),
          {
            value: "OWN",
            label: this.translateService.instant("Non-commercial independent facility"),
            group: this.translateService.instant("Other")
          },
          {
            value: "OTHER",
            label: this.translateService.instant("None of the above"),
            group: this.translateService.instant("Other")
          }
        ]
      }
    };
  }

  private _getGroupsField(): any {
    return {
      key: "partOfGroupSet",
      type: "ng-select",
      id: "image-groups-field",
      hideExpression: () => this.image.isWip,
      templateOptions: {
        multiple: true,
        required: false,
        label: this.translateService.instant("Groups"),
        description: this.translateService.instant("Submit this image to the selected groups."),
        options: this.store$.select(selectCurrentUser).pipe(
          switchMap(user =>
            this.groupApiService.getAll(user.id).pipe(
              map(groups =>
                groups.map(group => ({
                  value: group.id,
                  label: group.name
                }))
              )
            )
          )
        )
      }
    };
  }

  private _getThumbnailField(): any {
    return {
      key: "squareCropping",
      type: "image-cropper",
      id: "image-cropper-field",
      templateOptions: {
        required: true,
        description: this.translateService.instant(
          "Select an area of the image to be used as thumbnail in your gallery."
        ),
        image: this.image,
        thumbnailURL$: this.store$
          .select(selectThumbnail, {
            id: this.image.pk,
            revision: "0",
            alias: ImageAlias.HD
          })
          .pipe(
            map(thumbnail => {
              if (!thumbnail) {
                throw new Error("THUMBNAIL_NOT_READY");
              }
              return thumbnail.url;
            }),
            retryWithDelay(1000, 60),
            catchError(() => {
              this.popNotificationsService.error(
                "Timeout while loading the thumbnail, please refresh the page to try again!"
              );
              return EMPTY;
            })
          )
      }
    };
  }

  private _getSharpenThumbnailsField(): any {
    return {
      key: "sharpenThumbnails",
      type: "checkbox",
      id: "image-sharpen-thumbnails-field",
      templateOptions: {
        label: this.translateService.instant("Sharpen thumbnails"),
        description: this.translateService.instant(
          "If selected, AstroBin will use a resizing algorithm that slightly sharpens the image's thumbnails. " +
            "This setting applies to all revisions."
        )
      }
    };
  }

  private _getWatermarkCheckboxField(): any {
    return {
      key: "watermark",
      type: "checkbox",
      id: "image-watermark-field",
      templateOptions: {
        label: this.translateService.instant("Apply watermark to image"),
        description: this.translateService.instant(
          "AstroBin can protect your images from theft by applying a watermark to them. Please note: animated GIFs cannot be watermarked at this time."
        )
      }
    };
  }

  private _getWatermarkTextField(): any {
    return {
      key: "watermarkText",
      type: "input",
      id: "image-watermark-text-field",
      templateOptions: {
        label: this.translateService.instant("Text")
      }
    };
  }

  private _getWatermarkPosition(): any {
    return {
      key: "watermarkPosition",
      type: "ng-select",
      id: "image-watermark-position-field",
      templateOptions: {
        label: this.translateService.instant("Position"),
        options: [
          {
            value: WatermarkPositionOptions.CENTER,
            label: this.translateService.instant("Center")
          },
          {
            value: WatermarkPositionOptions.TOP_LEFT,
            label: this.translateService.instant("Top left")
          },
          {
            value: WatermarkPositionOptions.TOP_CENTER,
            label: this.translateService.instant("Top center")
          },
          {
            value: WatermarkPositionOptions.TOP_RIGHT,
            label: this.translateService.instant("Top right")
          },
          {
            value: WatermarkPositionOptions.BOTTOM_LEFT,
            label: this.translateService.instant("Bottom left")
          },
          {
            value: WatermarkPositionOptions.BOTTOM_CENTER,
            label: this.translateService.instant("Bottom center")
          },
          {
            value: WatermarkPositionOptions.BOTTOM_RIGHT,
            label: this.translateService.instant("Bottom right")
          }
        ]
      }
    };
  }

  private _getWatermarkTextSize(): any {
    return {
      key: "watermarkSize",
      type: "ng-select",
      id: "image-watermark-size-field",
      templateOptions: {
        label: this.translateService.instant("Size"),
        description: this.translateService.instant("The final font size will depend on how long your watermark is."),
        options: [
          {
            value: WatermarkSizeOptions.SMALL,
            label: this.translateService.instant("Small")
          },
          {
            value: WatermarkSizeOptions.MEDIUM,
            label: this.translateService.instant("Medium")
          },
          {
            value: WatermarkSizeOptions.LARGE,
            label: this.translateService.instant("Large")
          }
        ]
      }
    };
  }

  private _getWatermarkTextOpacity(): any {
    return {
      key: "watermarkOpacity",
      type: "input",
      id: "image-watermark-opacity-field",
      templateOptions: {
        type: "number",
        min: 0,
        max: 100,
        label: this.translateService.instant("Opacity") + " (%)",
        description: this.translateService.instant(
          "0 means invisible; 100 means completely opaque. Recommended values are: 10 if the watermark will appear on the dark sky background, 50 if on some bright object."
        )
      }
    };
  }

  private _getMouseHoverImageField(): any {
    return {
      key: "mouseHoverImage",
      type: "ng-select",
      id: "image-mouse-hover-image-field",
      templateOptions: {
        required: true,
        label: this.translateService.instant("Mouse hover image"),
        description: this.translateService.instant(
          "Choose what will be displayed when somebody hovers the mouse over this image. Please note: only " +
            "revisions with the same width and height of your original image can be considered."
        ),
        options: [
          {
            value: MouseHoverImageOptions.NOTHING,
            label: this.translateService.instant("Nothing")
          },
          {
            value: MouseHoverImageOptions.SOLUTION,
            label: this.translateService.instant("Plate-solution annotations (if available)")
          },
          {
            value: MouseHoverImageOptions.INVERTED,
            label: this.translateService.instant("Inverted monochrome")
          }
        ]
      }
    };
  }

  private _getAllowCommentsField(): any {
    return {
      key: "allowComments",
      type: "checkbox",
      id: "image-allow-comments-field",
      templateOptions: {
        label: this.translateService.instant("Allow comments")
      }
    };
  }

  private _initFields(): void {
    this.fields = [
      {
        type: "stepper",
        id: "image-stepper-field",
        templateOptions: {
          image: this.image,
          buttonsTemplate: this.stepperButtonsTemplate
        },
        fieldGroup: [
          {
            id: "image-stepper-thumbnail",
            templateOptions: { label: this.translateService.instant("Thumbnail") },
            fieldGroup: [this._getThumbnailField(), this._getSharpenThumbnailsField()]
          },
          {
            id: "image-stepper-watermark",
            templateOptions: { label: this.translateService.instant("Watermark") },
            fieldGroup: [
              this._getWatermarkCheckboxField(),
              this._getWatermarkTextField(),
              this._getWatermarkPosition(),
              this._getWatermarkTextSize(),
              this._getWatermarkTextOpacity()
            ]
          },
          {
            id: "image-stepper-basic-information",
            templateOptions: { label: this.translateService.instant("Basic information") },
            fieldGroup: [
              this._getTitleField(),
              this._getDescriptionField(),
              this._getLinkField(),
              this._getLinkToFitsField()
            ]
          },
          {
            id: "image-stepper-content",
            templateOptions: { label: this.translateService.instant("Content") },
            fieldGroup: [
              this._getAcquisitionTypeField(),
              this._getSubjectTypeField(),
              this._getSolarSystemMainSubjectField(),
              this._getDataSourceField(),
              this._getRemoteSourceField(),
              this._getGroupsField()
            ]
          },
          {
            id: "image-stepper-settings",
            templateOptions: { label: this.translateService.instant("Settings") },
            fieldGroup: [this._getMouseHoverImageField(), this._getAllowCommentsField()]
          }
        ]
      }
    ];
  }

  private _initBreadcrumb(): void {
    this.store$.dispatch(
      new SetBreadcrumb({
        breadcrumb: [
          {
            label: this.translateService.instant("Image")
          },
          {
            label: this.image.title
          },
          {
            label: this.translateService.instant("Edit")
          }
        ]
      })
    );
  }
}