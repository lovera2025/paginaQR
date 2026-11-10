import { describe, expect, it } from "vitest";
import { sugerirEmail } from "@/lib/utils";

describe("sugerirEmail (aviso de mail mal escrito)", () => {
  it.each([
    ["juan@gmial.com", "juan@gmail.com"],
    ["juan@gmai.com", "juan@gmail.com"],
    ["juan@gamil.com", "juan@gmail.com"],
    ["juan@gmail.con", "juan@gmail.com"],
    ["juan@gmail.co", "juan@gmail.com"],
    ["juan@gmail.com.ar", "juan@gmail.com"],
    ["juan@gmail", "juan@gmail.com"],
    ["juan@gmail,com", "juan@gmail.com"],
    ["Juan.Perez@GMIAL.COM", "juan.perez@gmail.com"],
    ["sofi@hotmial.com", "sofi@hotmail.com"],
    ["sofi@hotmail.con.ar", "sofi@hotmail.com.ar"],
    ["sofi@hotmai.com.ar", "sofi@hotmail.com.ar"],
    ["sofi@outlok.com", "sofi@outlook.com"],
    ["sofi@yaho.com.ar", "sofi@yahoo.com.ar"],
    ["sofi@iclod.com", "sofi@icloud.com"],
    ["sofi@empresa.con", "sofi@empresa.com"],
  ])("%s → %s", (entrada, esperado) => {
    expect(sugerirEmail(entrada)).toBe(esperado);
  });

  it.each([
    "juan@gmail.com",
    "juan@hotmail.com.ar",
    "juan@ymail.com",
    "juan@mail.com",
    "juan@me.com",
    "juan@colegio.edu.ar",
    "juan@fibertel.com.ar",
    "juan",
    "juan@",
    "@gmail.com",
    "",
  ])("%s no tiene sugerencia", (entrada) => {
    expect(sugerirEmail(entrada)).toBeNull();
  });
});
