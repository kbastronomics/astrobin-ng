context("Equipment", () => {
  beforeEach(() => {
    cy.server();
    cy.setupInitializationRoutes();
    cy.setupEquipmentDefaultRoutes();
  });

  context("Explorer", () => {
    it("should not have the 'Add' tag", () => {
      cy.visitPage("/equipment/explorer");

      cy.get("#equipment-item-field + .toggle-enable-fullscreen").click();
      cy.get("#equipment-item-field .ng-input input").type("Test");
      cy.wait("@findCameras");

      cy.get("#equipment-item-field .ng-option").should("have.length", 1);
      cy.get("#equipment-item-field .ng-option:nth-child(1)").should("contain", "No items found");
    });
  });
});
