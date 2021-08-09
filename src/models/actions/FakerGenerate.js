const { BaseAction } = require("./BaseAction");
const { performance } = require("perf_hooks");
const faker = require("faker");

class FakerGenerate extends BaseAction {
  eval(context) {
    const t0 = performance.now();
    let value;

    if (!this.parameters.category) {
      return {
        actionReports: [
          {
            action: "Faker.generate",
            success: false,
            shortSummary: `Category must be selected, got none`,
            longSummary: null,
            time: performance.now() - t0,
          },
        ],
      };
    }

    if (!this.parameters.function) {
      return {
        actionReports: [
          {
            action: "Faker.generate",
            success: false,
            shortSummary: `Function must be selected, got none`,
            longSummary: null,
            time: performance.now() - t0,
          },
        ],
      };
    }

    if (!faker.hasOwnProperty(this.parameters.category) || typeof faker[this.parameters.category] != "object") {
      return {
        actionReports: [
          {
            action: "Faker.generate",
            success: false,
            shortSummary: `Got invalid category ${this.parameters.category}`,
            longSummary: null,
            time: performance.now() - t0,
          },
        ],
      };
    }

    if (
      !faker[this.parameters.category].hasOwnProperty(this.parameters.function) ||
      typeof faker[this.parameters.category][this.parameters.function] != "function"
    ) {
      return {
        actionReports: [
          {
            action: "Faker.generate",
            success: false,
            shortSummary: `Got invalid function ${this.parameters.function}`,
            longSummary: null,
            time: performance.now() - t0,
          },
        ],
      };
    }

    value = faker[this.parameters.category][this.parameters.function]();
    context.set(this.parameters.variable, value);
    return {
      actionReports: [
        {
          action: "Faker.generate",
          success: true,
          shortSummary: `Faked ${this.parameters.category}.${this.parameters.function} and got value ${value}`,
          longSummary: null,
          time: performance.now() - t0,
        },
      ],
    };
  }
}

module.exports = { FakerGenerate };